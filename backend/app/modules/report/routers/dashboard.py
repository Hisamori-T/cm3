"""ダッシュボード集計エンドポイント（見積管理特化）。"""
from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.history import EditHistory
from app.models.project import Project
from app.models.quote import Quote, QuoteItem
from app.models.user import User

router = APIRouter(tags=["dashboard"])

PeriodType = Literal["current", "previous", "all"]

_STATUS_LABEL = {
    "draft":     "作成中",
    "submitted": "提出済",
    "won":       "受注",
    "lost":      "失注",
}


def _fiscal_year_range(period: PeriodType, today: date) -> tuple[date | None, date | None]:
    """事業年度（4月開始）の開始・終了日を返す。all の場合は None, None。"""
    fy_start_month = 4
    if today.month >= fy_start_month:
        current_fy_start = date(today.year, fy_start_month, 1)
        current_fy_end = date(today.year + 1, fy_start_month - 1, 31)
    else:
        current_fy_start = date(today.year - 1, fy_start_month, 1)
        current_fy_end = date(today.year, fy_start_month - 1, 31)

    if period == "current":
        return current_fy_start, current_fy_end
    if period == "previous":
        prev_fy_start = date(current_fy_start.year - 1, fy_start_month, 1)
        prev_fy_end = date(current_fy_start.year, fy_start_month - 1, 31)
        return prev_fy_start, prev_fy_end
    return None, None  # all


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
    month: str       # YYYY-MM
    amount: float    # 見積金額合計
    count: int       # 見積件数


class RecentActivity(BaseModel):
    entity_type: str
    change_type: str
    project_id: str | None
    changed_by_name: str
    changed_at: str


class DashboardResponse(BaseModel):
    kpi: list[KpiCard]
    status_distribution: list[StatusCount]
    monthly_stats: list[MonthlyStat]
    recent_activities: list[RecentActivity]
    period: str


# ── エンドポイント ────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    period: PeriodType = Query("current", description="today期間フィルタ: current/previous/all"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardResponse:
    """ダッシュボード集計データを返す（見積管理特化）。"""
    today = date.today()
    fy_start, fy_end = _fiscal_year_range(period, today)

    # ── 対象案件を取得 ──
    stmt = select(Project).where(Project.deleted_at.is_(None))
    if fy_start:
        stmt = stmt.where(Project.created_at >= fy_start)
    if fy_end:
        stmt = stmt.where(Project.created_at <= fy_end)
    projects = (await db.execute(stmt)).scalars().all()
    project_ids = [p.id for p in projects]

    total_count = len(projects)
    submitted_projects = [p for p in projects if p.status.value == "submitted"]
    won_projects = [p for p in projects if p.status.value == "won"]
    lost_projects = [p for p in projects if p.status.value == "lost"]

    # ── KPI 1: 今期見積金額（submitted + won の Quote.total_amount 合計）──
    quote_amount: float = 0.0
    if project_ids:
        amt_stmt = (
            select(func.sum(Quote.total_amount))
            .where(
                Quote.project_id.in_(project_ids),
                Quote.total_amount.is_not(None),
            )
        )
        quote_amount = float((await db.execute(amt_stmt)).scalar() or 0)

    # ── KPI 2: 見積件数（対象期間の全案件数）──

    # ── KPI 3: 平均利益率 ──
    # customer_total = Quote.subtotal (税抜), vendor_cost = sum(QuoteItem.cost_price × qty)
    avg_margin: float = 0.0
    if project_ids:
        # Quote ごとの subtotal を取得
        quote_stmt = (
            select(Quote.id, Quote.subtotal)
            .where(
                Quote.project_id.in_(project_ids),
                Quote.subtotal.is_not(None),
                Quote.subtotal > 0,
            )
        )
        quote_rows = (await db.execute(quote_stmt)).all()
        quote_subtotals = {row.id: float(row.subtotal) for row in quote_rows}

        if quote_subtotals:
            # QuoteItem の vendor cost 合計をまとめて取得
            cost_stmt = (
                select(
                    QuoteItem.quote_id,
                    func.sum(QuoteItem.cost_price * QuoteItem.quantity).label("vendor_cost"),
                )
                .where(
                    QuoteItem.quote_id.in_(list(quote_subtotals.keys())),
                    QuoteItem.cost_price.is_not(None),
                    QuoteItem.quantity.is_not(None),
                )
                .group_by(QuoteItem.quote_id)
            )
            cost_rows = (await db.execute(cost_stmt)).all()
            vendor_costs = {row.quote_id: float(row.vendor_cost or 0) for row in cost_rows}

            margins = []
            for qid, cust in quote_subtotals.items():
                if cust > 0:
                    vc = vendor_costs.get(qid, 0.0)
                    margins.append((cust - vc) / cust * 100)
            if margins:
                avg_margin = sum(margins) / len(margins)

    # ── KPI 4: 受注率 ──
    closed_count = len(submitted_projects) + len(won_projects) + len(lost_projects)
    win_rate = (len(won_projects) / closed_count * 100) if closed_count > 0 else 0.0

    period_label = {"current": "今期", "previous": "前期", "all": "全期間"}.get(period, "今期")
    kpi = [
        KpiCard(label=f"{period_label}見積金額", value=round(quote_amount), unit="円"),
        KpiCard(label=f"{period_label}見積件数", value=total_count, unit="件"),
        KpiCard(label="平均利益率", value=round(avg_margin, 1), unit="%"),
        KpiCard(label="受注率", value=round(win_rate, 1), unit="%"),
    ]

    # ── ステータス分布 ──
    status_counter: dict[str, int] = {}
    for p in projects:
        sv = p.status.value
        status_counter[sv] = status_counter.get(sv, 0) + 1

    status_distribution = [
        StatusCount(status=sv, label=_STATUS_LABEL.get(sv, sv), count=cnt)
        for sv, cnt in status_counter.items()
    ]
    status_order = ["draft", "submitted", "won", "lost"]
    status_distribution.sort(key=lambda x: status_order.index(x.status) if x.status in status_order else 99)

    # ── 月別推移（対象期間内）──
    from collections import defaultdict
    month_amounts: dict[str, float] = defaultdict(float)
    month_counts: dict[str, int] = defaultdict(int)

    if project_ids:
        monthly_stmt = (
            select(Project.created_at, Quote.total_amount)
            .outerjoin(Quote, Quote.project_id == Project.id)
            .where(Project.id.in_(project_ids))
        )
        monthly_rows = (await db.execute(monthly_stmt)).all()
        for row in monthly_rows:
            if row.created_at:
                ym = row.created_at.strftime("%Y-%m")
                month_amounts[ym] += float(row.total_amount or 0)
                month_counts[ym] += 1

    # 対象期間の月を列挙
    monthly_stats: list[MonthlyStat] = []
    if fy_start and fy_end:
        cur = date(fy_start.year, fy_start.month, 1)
        while cur <= fy_end:
            ym = cur.strftime("%Y-%m")
            monthly_stats.append(MonthlyStat(month=ym, amount=month_amounts.get(ym, 0), count=month_counts.get(ym, 0)))
            # 次の月へ
            if cur.month == 12:
                cur = date(cur.year + 1, 1, 1)
            else:
                cur = date(cur.year, cur.month + 1, 1)
    else:
        # 全期間: 直近12ヶ月
        for i in range(11, -1, -1):
            m = today.month - i
            y = today.year
            while m <= 0:
                m += 12
                y -= 1
            ym = f"{y:04d}-{m:02d}"
            monthly_stats.append(MonthlyStat(month=ym, amount=month_amounts.get(ym, 0), count=month_counts.get(ym, 0)))

    # ── 最近の活動（直近20件）──
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

    return DashboardResponse(
        kpi=kpi,
        status_distribution=status_distribution,
        monthly_stats=monthly_stats,
        recent_activities=recent_activities,
        period=period,
    )
