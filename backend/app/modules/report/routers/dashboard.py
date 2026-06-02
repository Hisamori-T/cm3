"""ダッシュボード集計エンドポイント。"""
from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.history import EditHistory
from app.models.invoice import Invoice
from app.models.project import Project
from app.models.user import User

router = APIRouter(tags=["dashboard"])


# ── スキーマ ──────────────────────────────────────────────────────────────────

class KpiCard(BaseModel):
    label: str
    value: int | float
    unit: str = ""


class StatusCount(BaseModel):
    status: str
    label: str
    count: int


class MonthlyStat(BaseModel):
    month: str  # YYYY-MM
    invoice_total: float
    project_count: int


class DeadlineAlert(BaseModel):
    project_id: str
    project_number: str
    project_name: str
    deadline: str
    days_left: int
    alert_type: str  # "contract_end" | "actual_end"


class RecentActivity(BaseModel):
    entity_type: str
    change_type: str
    project_id: str | None
    changed_by_name: str
    changed_at: str


class UnpaidAlert(BaseModel):
    project_id: str
    project_number: str
    project_name: str
    invoice_id: str
    invoice_number: str | None
    total_amount: float
    payment_due_date: str | None
    days_overdue: int
    status: str


class InvoiceStats(BaseModel):
    this_month_billed: float
    total_pending: float
    total_overdue: float
    overdue_count: int


class UserWorkHours(BaseModel):
    user_id: str
    user_name: str
    this_month_minutes: int


class DashboardResponse(BaseModel):
    kpi: list[KpiCard]
    status_distribution: list[StatusCount]
    monthly_stats: list[MonthlyStat]
    deadline_alerts: list[DeadlineAlert]
    recent_activities: list[RecentActivity]
    invoice_stats: InvoiceStats
    unpaid_alerts: list[UnpaidAlert]
    user_work_hours: list[UserWorkHours]


_STATUS_LABEL = {
    "quote": "見積中",
    "ordered": "受注",
    "started": "着工",
    "in_progress": "施工中",
    "completed": "完工",
    "billed": "請求済",
    "paid": "入金済",
}


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardResponse:
    """ダッシュボード集計データを返す。"""
    today = date.today()

    # ── 全アクティブ案件 ──
    active_stmt = select(Project).where(Project.deleted_at.is_(None))
    projects = (await db.execute(active_stmt)).scalars().all()

    total = len(projects)
    fy_start = date(today.year if today.month >= 4 else today.year - 1, 4, 1)
    fy_projects = [p for p in projects if p.created_at and p.created_at.date() >= fy_start]

    # ── 請求合計（billed / paid） ──
    inv_stmt = (
        select(func.sum(Invoice.total_amount))
        .join(Project, Project.id == Invoice.project_id)
        .where(Project.deleted_at.is_(None))
    )
    inv_total_row = (await db.execute(inv_stmt)).scalar() or 0
    inv_total = float(inv_total_row)

    kpi = [
        KpiCard(label="総案件数", value=total, unit="件"),
        KpiCard(label="今期新規案件", value=len(fy_projects), unit="件"),
        KpiCard(label="請求累計", value=round(inv_total / 10000) * 10000, unit="円"),
        KpiCard(label="完工案件", value=sum(1 for p in projects if p.status.value in ("completed", "billed", "paid")), unit="件"),
    ]

    # ── ステータス分布 ──
    status_distribution: list[StatusCount] = []
    status_counter: dict[str, int] = {}
    for p in projects:
        sv = p.status.value
        status_counter[sv] = status_counter.get(sv, 0) + 1
    status_order = ["quote", "ordered", "started", "in_progress", "completed", "billed", "paid"]
    for sv in status_order:
        if sv in status_counter:
            status_distribution.append(StatusCount(
                status=sv,
                label=_STATUS_LABEL.get(sv, sv),
                count=status_counter[sv],
            ))

    # ── 月別推移（直近12ヶ月） ──
    monthly_stats: list[MonthlyStat] = []
    inv_all_stmt = (
        select(Invoice.issue_date, Invoice.total_amount)
        .join(Project, Project.id == Invoice.project_id)
        .where(Project.deleted_at.is_(None), Invoice.issue_date.is_not(None))
    )
    inv_rows = (await db.execute(inv_all_stmt)).all()

    inv_by_month: dict[str, float] = {}
    for row in inv_rows:
        ym = row.issue_date.strftime("%Y-%m")
        inv_by_month[ym] = inv_by_month.get(ym, 0.0) + float(row.total_amount or 0)

    proj_by_month: dict[str, int] = {}
    for p in projects:
        if p.created_at:
            ym = p.created_at.strftime("%Y-%m")
            proj_by_month[ym] = proj_by_month.get(ym, 0) + 1

    for i in range(11, -1, -1):
        d = today.replace(day=1) - timedelta(days=i * 28)
        ym = d.strftime("%Y-%m")
        monthly_stats.append(MonthlyStat(
            month=ym,
            invoice_total=inv_by_month.get(ym, 0.0),
            project_count=proj_by_month.get(ym, 0),
        ))

    # ── 期限アラート（30日以内） ──
    deadline_alerts: list[DeadlineAlert] = []
    cutoff = today + timedelta(days=30)
    for p in projects:
        for field, atype in [
            ("period_contract_end", "contract_end"),
            ("period_actual_end", "actual_end"),
        ]:
            dt: date | None = getattr(p, field, None)
            if dt and today <= dt <= cutoff:
                days_left = (dt - today).days
                deadline_alerts.append(DeadlineAlert(
                    project_id=str(p.id),
                    project_number=p.project_number,
                    project_name=p.project_name,
                    deadline=dt.isoformat(),
                    days_left=days_left,
                    alert_type=atype,
                ))
    deadline_alerts.sort(key=lambda x: x.days_left)

    # ── 最近の活動（直近20件） ──
    hist_stmt = (
        select(EditHistory)
        .options(selectinload(EditHistory.changer))
        .order_by(EditHistory.changed_at.desc())
        .limit(20)
    )
    histories = (await db.execute(hist_stmt)).scalars().all()
    recent_activities = [
        RecentActivity(
            entity_type=h.entity_type,
            change_type=h.change_type.value if hasattr(h.change_type, "value") else str(h.change_type),
            project_id=str(h.project_id) if h.project_id else None,
            changed_by_name=h.changer.full_name if h.changer else "—",
            changed_at=h.changed_at.isoformat(),
        )
        for h in histories
    ]

    # ── 入金・売掛金集計 ──
    from app.models.enums import InvoiceStatus as IS
    from sqlalchemy.orm import joinedload

    unpaid_statuses = [IS.draft, IS.sent, IS.partially_paid]
    inv_unpaid_stmt = (
        select(Invoice)
        .options(joinedload(Invoice.project))
        .join(Project, Project.id == Invoice.project_id)
        .where(
            Project.deleted_at.is_(None),
            Invoice.status.in_(unpaid_statuses),
        )
    )
    unpaid_invoices = (await db.execute(inv_unpaid_stmt)).scalars().unique().all()

    # 今月発行分
    this_month_start = today.replace(day=1)
    inv_this_month_stmt = (
        select(func.coalesce(func.sum(Invoice.total_amount), 0))
        .join(Project, Project.id == Invoice.project_id)
        .where(
            Project.deleted_at.is_(None),
            Invoice.issue_date >= this_month_start,
            Invoice.issue_date <= today,
        )
    )
    this_month_billed = float((await db.execute(inv_this_month_stmt)).scalar() or 0)

    total_pending = sum(float(inv.total_amount or 0) for inv in unpaid_invoices)
    overdue_invs = [
        inv for inv in unpaid_invoices
        if inv.payment_due_date and inv.payment_due_date < today
    ]
    total_overdue = sum(float(inv.total_amount or 0) for inv in overdue_invs)

    invoice_stats = InvoiceStats(
        this_month_billed=this_month_billed,
        total_pending=total_pending,
        total_overdue=total_overdue,
        overdue_count=len(overdue_invs),
    )

    unpaid_alerts: list[UnpaidAlert] = []
    for inv in sorted(overdue_invs, key=lambda x: x.payment_due_date or today):
        days_overdue = (today - inv.payment_due_date).days if inv.payment_due_date else 0
        unpaid_alerts.append(UnpaidAlert(
            project_id=str(inv.project_id),
            project_number=inv.project.project_number,
            project_name=inv.project.project_name,
            invoice_id=str(inv.id),
            invoice_number=inv.invoice_number,
            total_amount=float(inv.total_amount or 0),
            payment_due_date=inv.payment_due_date.isoformat() if inv.payment_due_date else None,
            days_overdue=days_overdue,
            status=inv.status.value,
        ))

    # ── 担当者別稼働時間（今月） ──
    from app.models.daily_report import DailyReport as DR, DailyReportEntry as DRE
    from app.models.user import User as U2
    work_hours_stmt = (
        select(
            DR.user_id,
            U2.full_name,
            func.sum(DRE.working_minutes).label("total_minutes"),
        )
        .join(DRE, DRE.daily_report_id == DR.id)
        .join(U2, U2.id == DR.user_id)
        .where(DR.report_date >= this_month_start, DR.report_date <= today)
        .group_by(DR.user_id, U2.full_name)
        .order_by(func.sum(DRE.working_minutes).desc())
    )
    work_hours_rows = (await db.execute(work_hours_stmt)).all()
    user_work_hours = [
        UserWorkHours(
            user_id=str(row.user_id),
            user_name=row.full_name,
            this_month_minutes=int(row.total_minutes or 0),
        )
        for row in work_hours_rows
    ]

    return DashboardResponse(
        kpi=kpi,
        status_distribution=status_distribution,
        monthly_stats=monthly_stats,
        deadline_alerts=deadline_alerts[:10],
        recent_activities=recent_activities,
        invoice_stats=invoice_stats,
        unpaid_alerts=unpaid_alerts[:20],
        user_work_hours=user_work_hours,
    )
