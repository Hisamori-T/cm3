"""工事台帳（ledger）集約 API。G-2 実装（v2: 押印依頼・経費計算・直接工事費更新対応）。"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.acknowledgment import Acknowledgment
from app.models.approval import Notification
from app.models.ledger import LedgerApproval, ProjectLedgerMeta
from app.models.project import Project
from app.models.qcds import QCDS, QCDSDirectWork
from app.models.quote import Quote
from app.models.user import User
from app.services.qcds_calculator import calculate_qcds
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["ledger"])
logger = structlog.get_logger(__name__)

LEDGER_ROLE_LABELS = ["社長", "建築部長", "経理", "現場担当", "営業担当"]

# 現場経費 standard items
EXPENSE_ITEMS = [
    ("stamp_tax",            "契約印紙代"),
    ("labor_insurance",      "労災保険料"),
    ("construction_insurance","工事保険料"),
    ("office_supplies",      "事務用品費"),
    ("communication_cost",   "通信交通費"),
    ("misc_cost",            "雑費"),
]


# ---------------------------------------------------------------------------
# レスポンス スキーマ
# ---------------------------------------------------------------------------

class LedgerApprovalRead(BaseModel):
    id: uuid.UUID
    role_label: str
    # 押印情報
    approver_id: uuid.UUID | None
    approver_name: str | None
    approver_stamp_text: str | None  # stamp_text 優先、未設定なら姓
    approved_at: datetime | None
    comment: str | None
    display_order: int
    # 押印依頼情報
    approver_user_id: uuid.UUID | None
    approver_user_name: str | None
    requested_by_name: str | None
    requested_at: datetime | None


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
    monthly_payments: dict[str, float | None]
    note: str | None


class LedgerExpenseItemRead(BaseModel):
    system_key: str
    item_name: str
    computed_amount: float
    override_amount: float | None
    display_amount: float  # override があれば override、なければ computed


class LedgerCostSummary(BaseModel):
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
    period_quote_start: date | None
    period_quote_end: date | None
    period_contract_start: date | None
    period_contract_end: date | None
    period_actual_start: date | None
    period_actual_end: date | None
    prev_construction_type: str | None
    prev_construction_year: int | None
    prev_construction_other: str | None
    prev_construction_self: bool | None
    sales_person_name: str | None
    construction_person_name: str | None
    # 案件（顧客見積）
    project_price: float | None
    quote_number: str | None
    quote_issue_date: date | None
    quote_total_amount: float | None
    # 受注（注文請書）
    ack_issue_date: date | None
    ack_total_amount: float | None
    ack_number: str | None
    # ledger_meta 由来
    information_history: str | None
    client_requirements: str | None
    target_profit_rate: float | None
    target_profit_amount: float | None
    cost_summary: LedgerCostSummary | None
    direct_works: list[LedgerDirectWorkRead]
    expense_items: list[LedgerExpenseItemRead]
    approvals: list[LedgerApprovalRead]


# ---------------------------------------------------------------------------
# PATCH スキーマ
# ---------------------------------------------------------------------------

class LedgerMetaPatch(BaseModel):
    original_client_name: str | None = None
    project_summary: str | None = None
    payment_condition: str | None = None
    period_actual_start: date | None = None
    period_actual_end: date | None = None
    prev_construction_year: int | None = None
    prev_construction_other: str | None = None
    information_history: str | None = None
    client_requirements: str | None = None
    prev_construction_self: bool | None = None
    target_profit_rate: float | None = None
    target_profit_amount: float | None = None
    expense_overrides: dict[str, float | None] | None = None


class LedgerApproveRequest(BaseModel):
    role_label: str
    comment: str | None = None


class LedgerRequestApproveRequest(BaseModel):
    role_label: str
    approver_user_id: uuid.UUID


class LedgerDirectWorkPatch(BaseModel):
    agreed_amount: float | None = None
    agreement_checked: bool | None = None
    payment_month_4: float | None = None
    payment_month_5: float | None = None
    payment_month_6: float | None = None
    payment_month_7: float | None = None
    payment_month_8: float | None = None
    payment_month_9: float | None = None
    payment_month_10: float | None = None
    payment_month_11: float | None = None
    payment_month_12: float | None = None
    payment_month_1: float | None = None
    payment_month_2: float | None = None
    payment_month_3: float | None = None


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
            selectinload(Project.ledger_approvals).selectinload(LedgerApproval.approver_user),
            selectinload(Project.ledger_approvals).selectinload(LedgerApproval.requested_by),
        )
        .where(Project.id == project_id, Project.deleted_at == None)  # noqa: E711
    )).scalar_one_or_none()
    if proj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件が見つかりません")
    return proj


def _monthly_payments(w: QCDSDirectWork) -> dict[str, float | None]:
    return {
        "4":  float(w.payment_month_4)  if w.payment_month_4  is not None else None,
        "5":  float(w.payment_month_5)  if w.payment_month_5  is not None else None,
        "6":  float(w.payment_month_6)  if w.payment_month_6  is not None else None,
        "7":  float(w.payment_month_7)  if w.payment_month_7  is not None else None,
        "8":  float(w.payment_month_8)  if w.payment_month_8  is not None else None,
        "9":  float(w.payment_month_9)  if w.payment_month_9  is not None else None,
        "10": float(w.payment_month_10) if w.payment_month_10 is not None else None,
        "11": float(w.payment_month_11) if w.payment_month_11 is not None else None,
        "12": float(w.payment_month_12) if w.payment_month_12 is not None else None,
        "1":  float(w.payment_month_1)  if w.payment_month_1  is not None else None,
        "2":  float(w.payment_month_2)  if w.payment_month_2  is not None else None,
        "3":  float(w.payment_month_3)  if w.payment_month_3  is not None else None,
    }


async def _ensure_ledger_meta(project_id: uuid.UUID, db: AsyncSession) -> ProjectLedgerMeta:
    meta = (await db.execute(
        select(ProjectLedgerMeta).where(ProjectLedgerMeta.project_id == project_id)
    )).scalar_one_or_none()
    if meta is None:
        meta = ProjectLedgerMeta(project_id=project_id)
        db.add(meta)
        await db.flush()
    return meta


async def _ensure_ledger_approvals(project_id: uuid.UUID, db: AsyncSession) -> None:
    existing = (await db.execute(
        select(LedgerApproval.role_label).where(LedgerApproval.project_id == project_id)
    )).scalars().all()
    for i, label in enumerate(LEDGER_ROLE_LABELS):
        if label not in existing:
            db.add(LedgerApproval(project_id=project_id, role_label=label, display_order=i))
    await db.flush()


def _compute_expense_items(qcds: QCDS, project_price: float, overrides: dict | None) -> list[LedgerExpenseItemRead]:
    """QCDS モデルから現場経費6項目を計算する。"""
    pp = project_price or 0.0
    computed = {
        "stamp_tax":             0.0,  # 契約印紙代: 手動入力（将来: 印紙税テーブルから自動）
        "labor_insurance":       round(pp * float(qcds.labor_insurance_rate or 0)),
        "construction_insurance": round(pp * 1.1 * float(qcds.construction_insurance_rate or 0)),
        "office_supplies":       float(qcds.office_supplies or 0),
        "communication_cost":    float(qcds.communication_cost or 0),
        "misc_cost":             float(qcds.misc_cost or 0),
    }
    ov = overrides or {}
    result = []
    for key, name in EXPENSE_ITEMS:
        comp = computed.get(key, 0.0)
        over = ov.get(key)
        result.append(LedgerExpenseItemRead(
            system_key=key,
            item_name=name,
            computed_amount=comp,
            override_amount=over,
            display_amount=over if over is not None else comp,
        ))
    return result


def _build_response(
    proj: Project,
    qcds: QCDS | None,
    direct_works: list[QCDSDirectWork],
    quote: Quote | None,
    ack: Acknowledgment | None,
) -> LedgerResponse:
    meta = proj.ledger_meta

    cost_summary = None
    expense_items: list[LedgerExpenseItemRead] = []
    price = float(proj.project_price) if proj.project_price is not None else None

    if qcds is not None:
        qcds_price = price or 0.0
        calc = calculate_qcds(qcds, direct_works, qcds_price)
        if price:
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
        expense_items = _compute_expense_items(qcds, qcds_price, meta.expense_overrides if meta else None)

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

    def _stamp(user: Any) -> str | None:
        """stamp_text 優先、未設定なら full_name の姓（最初のスペース区切り）を返す。"""
        if not user:
            return None
        if user.stamp_text:
            return user.stamp_text
        name = user.full_name or ""
        parts = name.split()
        return parts[0] if parts else name or None

    approvals = [
        LedgerApprovalRead(
            id=a.id,
            role_label=a.role_label,
            approver_id=a.approver_id,
            approver_name=a.approver.full_name if a.approver else None,
            approver_stamp_text=_stamp(a.approver),
            approved_at=a.approved_at,
            comment=a.comment,
            display_order=a.display_order,
            approver_user_id=a.approver_user_id,
            approver_user_name=a.approver_user.full_name if a.approver_user else None,
            requested_by_name=a.requested_by.full_name if a.requested_by else None,
            requested_at=a.requested_at,
        )
        for a in proj.ledger_approvals
    ]

    # 工事価格: 注文請書があればその金額を優先
    ack_total = float(ack.total_amount) if ack and ack.total_amount else None
    display_price = ack_total if ack_total else price

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
        project_price=display_price,
        quote_number=quote.quote_number if quote else None,
        quote_issue_date=quote.issue_date if quote else None,
        quote_total_amount=float(quote.total_amount) if quote and quote.total_amount else None,
        ack_issue_date=ack.issue_date if ack else None,
        ack_total_amount=ack_total,
        ack_number=ack.acknowledgment_number if ack else None,
        information_history=meta.information_history if meta else None,
        client_requirements=meta.client_requirements if meta else None,
        target_profit_rate=float(meta.target_profit_rate) if meta and meta.target_profit_rate else None,
        target_profit_amount=float(meta.target_profit_amount) if meta and meta.target_profit_amount else None,
        cost_summary=cost_summary,
        direct_works=dw_reads,
        expense_items=expense_items,
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
    await _ensure_ledger_approvals(project_id, db)
    await _ensure_ledger_meta(project_id, db)
    await db.commit()
    proj = await _get_project(project_id, db)

    qcds = (await db.execute(
        select(QCDS)
        .options(selectinload(QCDS.direct_works), selectinload(QCDS.expense_items))
        .where(QCDS.project_id == project_id)
        .order_by(QCDS.revision.desc())
        .limit(1)
    )).scalar_one_or_none()

    direct_works: list[QCDSDirectWork] = []
    if qcds is not None:
        direct_works = [w for w in qcds.direct_works if w.budget_amount or w.agreed_amount or w.vendor_name_snapshot]

    # 最新の顧客見積（■ 案件）
    quote = (await db.execute(
        select(Quote)
        .where(Quote.project_id == project_id)
        .order_by(Quote.created_at.desc())
        .limit(1)
    )).scalar_one_or_none()

    # 最新の注文請書（□ 受注・工事価格）
    ack = (await db.execute(
        select(Acknowledgment)
        .where(Acknowledgment.project_id == project_id)
        .order_by(Acknowledgment.created_at.desc())
        .limit(1)
    )).scalar_one_or_none()

    return _build_response(proj, qcds, direct_works, quote, ack)


@router.patch("/projects/{project_id}/ledger/meta", response_model=LedgerResponse)
async def patch_ledger_meta(
    project_id: uuid.UUID,
    body: LedgerMetaPatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LedgerResponse:
    """工事台帳の手動入力フィールドを更新する。"""
    proj = (await db.execute(
        select(Project).where(Project.id == project_id, Project.deleted_at == None)  # noqa: E711
    )).scalar_one_or_none()
    if proj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件が見つかりません")

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

    # expense_overrides: マージ更新（既存キーを上書き、null なら削除）
    if body.expense_overrides is not None:
        existing = dict(meta.expense_overrides or {})
        for k, v in body.expense_overrides.items():
            if v is None:
                existing.pop(k, None)
            else:
                existing[k] = v
        meta.expense_overrides = existing

    await db.commit()
    return await get_ledger(project_id, db, current_user)


@router.post("/projects/{project_id}/ledger/request-approve", response_model=LedgerApprovalRead)
async def request_ledger_approval(
    project_id: uuid.UUID,
    body: LedgerRequestApproveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LedgerApprovalRead:
    """工事台帳の承認枠に押印依頼を送る（通知送信）。"""
    if body.role_label not in LEDGER_ROLE_LABELS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"無効な role_label: {body.role_label}")

    await _ensure_ledger_approvals(project_id, db)

    approval = (await db.execute(
        select(LedgerApproval)
        .options(
            selectinload(LedgerApproval.approver),
            selectinload(LedgerApproval.approver_user),
            selectinload(LedgerApproval.requested_by),
        )
        .where(LedgerApproval.project_id == project_id, LedgerApproval.role_label == body.role_label)
    )).scalar_one_or_none()
    if approval is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="承認枠が見つかりません")

    # 対象者確認
    target_user = (await db.execute(
        select(User).where(User.id == body.approver_user_id)
    )).scalar_one_or_none()
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ユーザーが見つかりません")

    # 押印依頼セット
    approval.approver_user_id = body.approver_user_id
    approval.requested_by_id = current_user.id
    approval.requested_at = datetime.now(tz=timezone.utc)

    # 通知送信
    proj = (await db.execute(
        select(Project).where(Project.id == project_id)
    )).scalar_one_or_none()
    proj_name = proj.project_name if proj else str(project_id)
    db.add(Notification(
        user_id=body.approver_user_id,
        title=f"工事台帳 押印依頼: {proj_name}",
        body=f"{current_user.full_name} さんから【{body.role_label}】の押印依頼が届きました。",
        related_type="ledger",
        related_id=project_id,
    ))

    await db.commit()
    # reload
    approval = (await db.execute(
        select(LedgerApproval)
        .options(
            selectinload(LedgerApproval.approver),
            selectinload(LedgerApproval.approver_user),
            selectinload(LedgerApproval.requested_by),
        )
        .where(LedgerApproval.id == approval.id)
    )).scalar_one()

    return LedgerApprovalRead(
        id=approval.id, role_label=approval.role_label,
        approver_id=approval.approver_id,
        approver_name=approval.approver.full_name if approval.approver else None,
        approved_at=approval.approved_at, comment=approval.comment,
        display_order=approval.display_order,
        approver_user_id=approval.approver_user_id,
        approver_user_name=approval.approver_user.full_name if approval.approver_user else None,
        requested_by_name=approval.requested_by.full_name if approval.requested_by else None,
        requested_at=approval.requested_at,
    )


@router.post("/projects/{project_id}/ledger/approve", response_model=LedgerApprovalRead)
async def approve_ledger(
    project_id: uuid.UUID,
    body: LedgerApproveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LedgerApprovalRead:
    """押印依頼を受けた人が実際に工事台帳に押印する。"""
    if body.role_label not in LEDGER_ROLE_LABELS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"無効な role_label: {body.role_label}")

    await _ensure_ledger_approvals(project_id, db)

    approval = (await db.execute(
        select(LedgerApproval)
        .options(
            selectinload(LedgerApproval.approver),
            selectinload(LedgerApproval.approver_user),
            selectinload(LedgerApproval.requested_by),
        )
        .where(LedgerApproval.project_id == project_id, LedgerApproval.role_label == body.role_label)
    )).scalar_one_or_none()
    if approval is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="承認枠が見つかりません")

    # 押印権限チェック: 依頼先ユーザー or admin/super_admin
    from app.shared.services.permissions import is_admin as _is_admin
    from app.models.enums import UserRole
    _admin_ok = _is_admin(current_user)
    is_designated = approval.approver_user_id == current_user.id
    if not _admin_ok and not is_designated and approval.approver_user_id is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="押印権限がありません")

    approval.approver_id = current_user.id
    approval.approved_at = datetime.now(tz=timezone.utc)
    approval.comment = body.comment
    await db.commit()

    approval = (await db.execute(
        select(LedgerApproval)
        .options(
            selectinload(LedgerApproval.approver),
            selectinload(LedgerApproval.approver_user),
            selectinload(LedgerApproval.requested_by),
        )
        .where(LedgerApproval.id == approval.id)
    )).scalar_one()

    return LedgerApprovalRead(
        id=approval.id, role_label=approval.role_label,
        approver_id=approval.approver_id,
        approver_name=approval.approver.full_name if approval.approver else None,
        approved_at=approval.approved_at, comment=approval.comment,
        display_order=approval.display_order,
        approver_user_id=approval.approver_user_id,
        approver_user_name=approval.approver_user.full_name if approval.approver_user else None,
        requested_by_name=approval.requested_by.full_name if approval.requested_by else None,
        requested_at=approval.requested_at,
    )


@router.delete("/projects/{project_id}/ledger/approve/{role_label}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_ledger_approval(
    project_id: uuid.UUID,
    role_label: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """工事台帳の押印を取り消す（依頼もリセット）。"""
    approval = (await db.execute(
        select(LedgerApproval)
        .where(LedgerApproval.project_id == project_id, LedgerApproval.role_label == role_label)
    )).scalar_one_or_none()
    if approval is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="承認枠が見つかりません")

    from app.shared.services.permissions import is_admin as _is_admin
    if approval.approver_id != current_user.id and not _is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="取消権限がありません")

    approval.approver_id = None
    approval.approved_at = None
    approval.comment = None
    approval.approver_user_id = None
    approval.requested_by_id = None
    approval.requested_at = None
    await db.commit()


@router.patch("/projects/{project_id}/ledger/direct-works/{work_id}", response_model=LedgerDirectWorkRead)
async def patch_direct_work(
    project_id: uuid.UUID,
    work_id: uuid.UUID,
    body: LedgerDirectWorkPatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LedgerDirectWorkRead:
    """取決金額・取決済チェック・月別支払額を更新する。"""
    work = (await db.execute(
        select(QCDSDirectWork)
        .join(QCDS, QCDSDirectWork.qcds_id == QCDS.id)
        .where(QCDSDirectWork.id == work_id, QCDS.project_id == project_id)
    )).scalar_one_or_none()
    if work is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="工事費行が見つかりません")

    _fields = {
        "agreed_amount": body.agreed_amount,
        "agreement_checked": body.agreement_checked,
        "payment_month_4": body.payment_month_4,
        "payment_month_5": body.payment_month_5,
        "payment_month_6": body.payment_month_6,
        "payment_month_7": body.payment_month_7,
        "payment_month_8": body.payment_month_8,
        "payment_month_9": body.payment_month_9,
        "payment_month_10": body.payment_month_10,
        "payment_month_11": body.payment_month_11,
        "payment_month_12": body.payment_month_12,
        "payment_month_1": body.payment_month_1,
        "payment_month_2": body.payment_month_2,
        "payment_month_3": body.payment_month_3,
    }
    for attr, val in _fields.items():
        if val is not None:
            setattr(work, attr, val)
        elif body.model_fields_set and attr in body.model_fields_set:
            # 明示的に null が送られた場合はクリア
            setattr(work, attr, None)

    # agreement_checked は bool なので None チェックが難しい → 送られた場合のみ更新
    if body.agreement_checked is not None:
        work.agreement_checked = body.agreement_checked

    await db.commit()
    await db.refresh(work)

    return LedgerDirectWorkRead(
        id=work.id, row_no=work.row_no,
        vendor_name=work.vendor_name_snapshot, work_type=work.work_type,
        budget_amount=float(work.budget_amount) if work.budget_amount is not None else None,
        agreed_amount=float(work.agreed_amount) if work.agreed_amount is not None else None,
        settlement_amount=float(work.settlement_amount) if work.settlement_amount is not None else None,
        agreement_checked=work.agreement_checked,
        payment_completed=work.payment_completed,
        monthly_payments=_monthly_payments(work),
        note=work.note,
    )

# ─── 自分宛の押印依頼一覧（承認待ちページ用）─────────────────────────────────

class LedgerApprovalPendingRead(BaseModel):
    approval_id: uuid.UUID
    project_id: uuid.UUID
    project_number: str
    project_name: str
    role_label: str
    requested_by_name: str | None
    requested_at: datetime | None


@router.get("/ledger-approvals/pending-for-me", response_model=list[LedgerApprovalPendingRead])
async def get_pending_ledger_approvals_for_me(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[LedgerApprovalPendingRead]:
    """自分宛の未押印（承認待ち）工事台帳押印依頼一覧。"""
    rows = (await db.execute(
        select(LedgerApproval)
        .options(
            selectinload(LedgerApproval.requested_by),
            selectinload(LedgerApproval.project),
        )
        .where(
            LedgerApproval.approver_user_id == current_user.id,
            LedgerApproval.approved_at == None,  # noqa: E711
        )
        .order_by(LedgerApproval.requested_at.desc())
    )).scalars().all()

    result = []
    for r in rows:
        if not r.project:
            continue
        result.append(LedgerApprovalPendingRead(
            approval_id=r.id,
            project_id=r.project_id,
            project_number=r.project.project_number,
            project_name=r.project.project_name,
            role_label=r.role_label,
            requested_by_name=r.requested_by.full_name if r.requested_by else None,
            requested_at=r.requested_at,
        ))
    return result
