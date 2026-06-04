"""工事台帳（ledger）集約 API。G-2 実装。"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from math import floor
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.ledger import LedgerApproval, ProjectLedgerMeta
from app.models.project import Project
from app.models.qcds import QCDS, QCDSDirectWork
from app.models.quote import Quote
from app.models.user import User
from app.services.qcds_calculator import calculate_qcds

router = APIRouter(tags=["ledger"])
logger = structlog.get_logger(__name__)

LEDGER_ROLE_LABELS = ["社長", "建築部長", "経理", "担当"]


# ---------------------------------------------------------------------------
# レスポンス スキーマ
# ---------------------------------------------------------------------------

class LedgerApprovalRead(BaseModel):
    id: uuid.UUID
    role_label: str
    approver_id: uuid.UUID | None
    approver_name: str | None
    approved_at: datetime | None
    comment: str | None
    display_order: int


class LedgerDirectWorkRead(BaseModel):
    id: uuid.UUID
    row_no: int
    vendor_name: str | None
    work_type: str | None
    budget_amount: float | None
    agreed_amount: float | None
    settlement_amount: float | None
    agreement_checked: bool
    payment_completed: bool
    monthly_payments: dict[str, float | None]  # "4"〜"3" の月キー
    note: str | None


class LedgerExpenseItemRead(BaseModel):
    item_name: str
    amount: float | None
    section: str


class LedgerCostSummary(BaseModel):
    """工事割出 3列集計（実行予算・取決見通・精算見通）。"""
    direct_cost_budget: float
    direct_cost_agreed: float
    direct_cost_settlement: float
    site_overhead_total: float
    construction_dept_overhead: float
    general_admin_cost: float
    operating_profit: float
    operating_profit_rate: float
    target_operating_profit: float


class LedgerResponse(BaseModel):
    project_id: uuid.UUID
    project_number: str
    project_name: str
    project_location: str | None
    client_name: str | None
    original_client_name: str | None
    project_summary: str | None
    payment_condition: str | None
    # 工期
    period_quote_start: date | None
    period_quote_end: date | None
    period_contract_start: date | None
    period_contract_end: date | None
    period_actual_start: date | None
    period_actual_end: date | None
    # 前施工
    prev_construction_type: str | None
    prev_construction_year: int | None
    prev_construction_other: str | None
    prev_construction_self: bool | None  # ledger_meta 由来
    # 担当
    sales_person_name: str | None
    construction_person_name: str | None
    # 案件/受注情報
    project_price: float | None
    quote_number: str | None
    quote_issue_date: date | None
    quote_total_amount: float | None
    award_date: date | None
    # ledger_meta 由来
    information_history: str | None
    client_requirements: str | None
    target_profit_rate: float | None
    target_profit_amount: float | None
    # 工事割出
    cost_summary: LedgerCostSummary | None
    # 表4
    direct_works: list[LedgerDirectWorkRead]
    # 現場経費内訳
    expense_items: list[LedgerExpenseItemRead]
    # 承認枠
    approvals: list[LedgerApprovalRead]


# ---------------------------------------------------------------------------
# PATCH スキーマ
# ---------------------------------------------------------------------------

class LedgerMetaPatch(BaseModel):
    """工事台帳の手動入力フィールド更新。projects + project_ledger_meta にまたがる。"""
    # projects 由来
    original_client_name: str | None = None
    project_summary: str | None = None
    payment_condition: str | None = None
    period_actual_start: date | None = None
    period_actual_end: date | None = None
    prev_construction_year: int | None = None
    prev_construction_other: str | None = None
    # project_ledger_meta 由来
    information_history: str | None = None
    client_requirements: str | None = None
    prev_construction_self: bool | None = None
    target_profit_rate: float | None = None
    target_profit_amount: float | None = None


class LedgerApproveRequest(BaseModel):
    role_label: str
    comment: str | None = None


# ---------------------------------------------------------------------------
# ヘルパー
# ---------------------------------------------------------------------------

async def _get_project(project_id: uuid.UUID, db: AsyncSession) -> Project:
    proj = (await db.execute(
        select(Project)
        .options(
            selectinload(Project.sales_person),
            selectinload(Project.construction_person),
            selectinload(Project.ledger_meta),
            selectinload(Project.ledger_approvals).selectinload(LedgerApproval.approver),
        )
        .where(Project.id == project_id, Project.deleted_at == None)  # noqa: E711
    )).scalar_one_or_none()
    if proj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件が見つかりません")
    return proj


def _monthly_payments(w: QCDSDirectWork) -> dict[str, float | None]:
    return {
        "4": float(w.payment_month_4) if w.payment_month_4 is not None else None,
        "5": float(w.payment_month_5) if w.payment_month_5 is not None else None,
        "6": float(w.payment_month_6) if w.payment_month_6 is not None else None,
        "7": float(w.payment_month_7) if w.payment_month_7 is not None else None,
        "8": float(w.payment_month_8) if w.payment_month_8 is not None else None,
        "9": float(w.payment_month_9) if w.payment_month_9 is not None else None,
        "10": float(w.payment_month_10) if w.payment_month_10 is not None else None,
        "11": float(w.payment_month_11) if w.payment_month_11 is not None else None,
        "12": float(w.payment_month_12) if w.payment_month_12 is not None else None,
        "1": float(w.payment_month_1) if w.payment_month_1 is not None else None,
        "2": float(w.payment_month_2) if w.payment_month_2 is not None else None,
        "3": float(w.payment_month_3) if w.payment_month_3 is not None else None,
    }


async def _ensure_ledger_meta(project_id: uuid.UUID, db: AsyncSession) -> ProjectLedgerMeta:
    """project_ledger_meta が存在しなければ自動作成して返す。"""
    meta = (await db.execute(
        select(ProjectLedgerMeta).where(ProjectLedgerMeta.project_id == project_id)
    )).scalar_one_or_none()
    if meta is None:
        meta = ProjectLedgerMeta(project_id=project_id)
        db.add(meta)
        await db.flush()
    return meta


async def _ensure_ledger_approvals(project_id: uuid.UUID, db: AsyncSession) -> None:
    """ledger_approvals の4枠が存在しなければ自動挿入する。"""
    existing = (await db.execute(
        select(LedgerApproval.role_label).where(LedgerApproval.project_id == project_id)
    )).scalars().all()
    for i, label in enumerate(LEDGER_ROLE_LABELS):
        if label not in existing:
            db.add(LedgerApproval(project_id=project_id, role_label=label, display_order=i))
    await db.flush()


def _build_response(
    proj: Project,
    qcds: QCDS | None,
    direct_works: list[QCDSDirectWork],
    expense_items: list[Any],
    quote: Quote | None,
) -> LedgerResponse:
    meta = proj.ledger_meta

    cost_summary = None
    if qcds is not None and proj.project_price:
        calc = calculate_qcds(qcds, direct_works, float(proj.project_price))
        cost_summary = LedgerCostSummary(
            direct_cost_budget=calc.direct_cost_budget,
            direct_cost_agreed=calc.direct_cost_agreed,
            direct_cost_settlement=calc.direct_cost_settlement,
            site_overhead_total=calc.site_overhead_total,
            construction_dept_overhead=calc.construction_dept_overhead,
            general_admin_cost=calc.general_admin_cost,
            operating_profit=calc.operating_profit,
            operating_profit_rate=calc.operating_profit_rate,
            target_operating_profit=calc.target_operating_profit,
        )

    dw_reads = [
        LedgerDirectWorkRead(
            id=w.id,
            row_no=w.row_no,
            vendor_name=w.vendor_name_snapshot,
            work_type=w.work_type,
            budget_amount=float(w.budget_amount) if w.budget_amount is not None else None,
            agreed_amount=float(w.agreed_amount) if w.agreed_amount is not None else None,
            settlement_amount=float(w.settlement_amount) if w.settlement_amount is not None else None,
            agreement_checked=w.agreement_checked,
            payment_completed=w.payment_completed,
            monthly_payments=_monthly_payments(w),
            note=w.note,
        )
        for w in direct_works
    ]

    exp_reads = [
        LedgerExpenseItemRead(
            item_name=e.item_name,
            amount=float(e.amount_override) if e.amount_override is not None else None,
            section=e.section,
        )
        for e in expense_items
        if e.section == "B_site"
    ]

    approvals = [
        LedgerApprovalRead(
            id=a.id,
            role_label=a.role_label,
            approver_id=a.approver_id,
            approver_name=a.approver.full_name if a.approver else None,
            approved_at=a.approved_at,
            comment=a.comment,
            display_order=a.display_order,
        )
        for a in proj.ledger_approvals
    ]

    return LedgerResponse(
        project_id=proj.id,
        project_number=proj.project_number,
        project_name=proj.project_name,
        project_location=proj.project_location,
        client_name=proj.client_name,
        original_client_name=proj.original_client_name,
        project_summary=proj.project_summary,
        payment_condition=proj.payment_condition,
        period_quote_start=proj.period_quote_start,
        period_quote_end=proj.period_quote_end,
        period_contract_start=proj.period_contract_start,
        period_contract_end=proj.period_contract_end,
        period_actual_start=proj.period_actual_start,
        period_actual_end=proj.period_actual_end,
        prev_construction_type=proj.prev_construction_type.value if proj.prev_construction_type else None,
        prev_construction_year=proj.prev_construction_year,
        prev_construction_other=proj.prev_construction_other,
        prev_construction_self=meta.prev_construction_self if meta else None,
        sales_person_name=proj.sales_person.full_name if proj.sales_person else None,
        construction_person_name=proj.construction_person.full_name if proj.construction_person else None,
        project_price=float(proj.project_price) if proj.project_price is not None else None,
        quote_number=quote.quote_number if quote else None,
        quote_issue_date=quote.issue_date if quote else None,
        quote_total_amount=float(quote.total_amount) if quote and quote.total_amount else None,
        award_date=None,  # projects に award_date カラムなし → 将来対応
        information_history=meta.information_history if meta else None,
        client_requirements=meta.client_requirements if meta else None,
        target_profit_rate=float(meta.target_profit_rate) if meta and meta.target_profit_rate else None,
        target_profit_amount=float(meta.target_profit_amount) if meta and meta.target_profit_amount else None,
        cost_summary=cost_summary,
        direct_works=dw_reads,
        expense_items=exp_reads,
        approvals=approvals,
    )


# ---------------------------------------------------------------------------
# エンドポイント
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/ledger", response_model=LedgerResponse)
async def get_ledger(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LedgerResponse:
    """工事台帳の全データを集約して返す。"""
    proj = await _get_project(project_id, db)

    # 承認枠を自動初期化
    await _ensure_ledger_approvals(project_id, db)
    await _ensure_ledger_meta(project_id, db)
    await db.commit()
    # コミット後に再ロード
    proj = await _get_project(project_id, db)

    # QCDS
    qcds = (await db.execute(
        select(QCDS)
        .options(selectinload(QCDS.direct_works), selectinload(QCDS.expense_items))
        .where(QCDS.project_id == project_id)
        .order_by(QCDS.revision.desc())
        .limit(1)
    )).scalar_one_or_none()

    direct_works: list[QCDSDirectWork] = []
    expense_items = []
    if qcds is not None:
        direct_works = [w for w in qcds.direct_works if w.budget_amount or w.agreed_amount or w.vendor_name_snapshot]
        expense_items = qcds.expense_items

    # 最新見積
    quote = (await db.execute(
        select(Quote)
        .where(Quote.project_id == project_id)
        .order_by(Quote.created_at.desc())
        .limit(1)
    )).scalar_one_or_none()

    return _build_response(proj, qcds, direct_works, expense_items, quote)


@router.patch("/projects/{project_id}/ledger/meta", response_model=LedgerResponse)
async def patch_ledger_meta(
    project_id: uuid.UUID,
    body: LedgerMetaPatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LedgerResponse:
    """工事台帳の手動入力フィールドを更新する。projects と project_ledger_meta にまたがる。"""
    proj = (await db.execute(
        select(Project).where(Project.id == project_id, Project.deleted_at == None)  # noqa: E711
    )).scalar_one_or_none()
    if proj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件が見つかりません")

    # projects フィールド更新
    _project_fields = {
        "original_client_name": body.original_client_name,
        "project_summary": body.project_summary,
        "payment_condition": body.payment_condition,
        "period_actual_start": body.period_actual_start,
        "period_actual_end": body.period_actual_end,
        "prev_construction_year": body.prev_construction_year,
        "prev_construction_other": body.prev_construction_other,
    }
    for attr, val in _project_fields.items():
        if val is not None:
            setattr(proj, attr, val)

    # project_ledger_meta フィールド更新（upsert）
    meta = await _ensure_ledger_meta(project_id, db)
    _meta_fields = {
        "information_history": body.information_history,
        "client_requirements": body.client_requirements,
        "prev_construction_self": body.prev_construction_self,
        "target_profit_rate": body.target_profit_rate,
        "target_profit_amount": body.target_profit_amount,
    }
    for attr, val in _meta_fields.items():
        if val is not None:
            setattr(meta, attr, val)

    await db.commit()
    return await get_ledger(project_id, db, current_user)


@router.post("/projects/{project_id}/ledger/approve", response_model=LedgerApprovalRead, status_code=status.HTTP_200_OK)
async def approve_ledger(
    project_id: uuid.UUID,
    body: LedgerApproveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LedgerApprovalRead:
    """工事台帳の承認枠に現在のユーザーで押印する。"""
    if body.role_label not in LEDGER_ROLE_LABELS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"無効な role_label: {body.role_label}")

    await _ensure_ledger_approvals(project_id, db)

    approval = (await db.execute(
        select(LedgerApproval)
        .options(selectinload(LedgerApproval.approver))
        .where(LedgerApproval.project_id == project_id, LedgerApproval.role_label == body.role_label)
    )).scalar_one_or_none()
    if approval is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="承認枠が見つかりません")

    from datetime import timezone
    approval.approver_id = current_user.id
    approval.approved_at = datetime.now(tz=timezone.utc)
    approval.comment = body.comment

    await db.commit()
    await db.refresh(approval)
    # approver をリロード
    approval = (await db.execute(
        select(LedgerApproval)
        .options(selectinload(LedgerApproval.approver))
        .where(LedgerApproval.id == approval.id)
    )).scalar_one()

    return LedgerApprovalRead(
        id=approval.id,
        role_label=approval.role_label,
        approver_id=approval.approver_id,
        approver_name=approval.approver.full_name if approval.approver else None,
        approved_at=approval.approved_at,
        comment=approval.comment,
        display_order=approval.display_order,
    )


@router.delete("/projects/{project_id}/ledger/approve/{role_label}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_ledger_approval(
    project_id: uuid.UUID,
    role_label: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """工事台帳の承認枠の押印を取り消す（admin または押印者本人のみ）。"""
    approval = (await db.execute(
        select(LedgerApproval)
        .where(LedgerApproval.project_id == project_id, LedgerApproval.role_label == role_label)
    )).scalar_one_or_none()
    if approval is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="承認枠が見つかりません")

    if approval.approver_id != current_user.id and current_user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="取消権限がありません")

    approval.approver_id = None
    approval.approved_at = None
    approval.comment = None
    await db.commit()
