"""控除項目サービス — 追加・更新・削除・合計再計算・進捗サマリー。"""
from __future__ import annotations

import uuid
from math import floor

import structlog
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import EditHistoryChangeType, InvoiceStatus
from app.models.invoice import Invoice, InvoiceDeduction
from app.schemas.invoice import (
    InvoiceDeductionCreate,
    InvoiceDeductionRead,
    InvoiceDeductionUpdate,
    ProgressSummaryResponse,
)
from app.services.history import record as record_history
from app.shared.constants.deduction import DEDUCTION_LABEL_JA

logger = structlog.get_logger(__name__)


# ── ヘルパー ────────────────────────────────────────────────────────────────

async def _get_invoice_or_404(
    invoice_id: uuid.UUID,
    project_id: uuid.UUID,
    db: AsyncSession,
) -> Invoice:
    inv = await db.get(Invoice, invoice_id)
    if inv is None or inv.project_id != project_id:
        raise HTTPException(status_code=404, detail="請求書が見つかりません")
    return inv


def _guard_draft(invoice: Invoice) -> None:
    """draft 以外では控除変更を拒否する。"""
    if invoice.status != InvoiceStatus.draft:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="発行済み / 支払済みの請求書は変更できません",
        )


def _calc_amount(
    body: InvoiceDeductionCreate | InvoiceDeductionUpdate,
    invoice: Invoice,
) -> int:
    """控除金額を確定する（rate 指定時は current_purchase から自動計算）。"""
    if getattr(body, "calculation_rate", None) is not None:
        base = int(invoice.current_purchase or 0)
        return floor(base * float(body.calculation_rate))
    if body.amount is not None:
        return int(body.amount)
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="amount または calculation_rate のどちらかが必要です",
    )


async def _recalculate_totals(invoice: Invoice, db: AsyncSession) -> None:
    """active な控除の合計を集計し、Invoice の total/final を更新する。"""
    result = await db.execute(
        select(func.sum(InvoiceDeduction.amount))
        .where(
            InvoiceDeduction.invoice_id == invoice.id,
            InvoiceDeduction.is_deleted.is_(False),
        )
    )
    total_deduction = int(result.scalar() or 0)
    invoice.total_deduction_amount = total_deduction
    invoice.final_payable_amount = int(invoice.total_amount or 0) - total_deduction
    logger.info(
        "deduction_totals_updated",
        invoice_id=str(invoice.id),
        total_deduction=total_deduction,
        final_payable=invoice.final_payable_amount,
    )


def _to_deduction_read(d: InvoiceDeduction) -> InvoiceDeductionRead:
    return InvoiceDeductionRead(
        id=d.id,
        invoice_id=d.invoice_id,
        deduction_type=d.deduction_type,
        description=d.description,
        amount=float(d.amount),
        calculation_rate=float(d.calculation_rate) if d.calculation_rate is not None else None,
        account_hint=d.account_hint,
        is_deleted=d.is_deleted,
        row_no=d.row_no,
        created_at=d.created_at,
    )


# ── 控除 追加 ───────────────────────────────────────────────────────────────

async def add_deduction(
    project_id: uuid.UUID,
    invoice_id: uuid.UUID,
    body: InvoiceDeductionCreate,
    db: AsyncSession,
    user_id: uuid.UUID,
) -> InvoiceDeductionRead:
    """控除項目を追加する。"""
    invoice = await _get_invoice_or_404(invoice_id, project_id, db)
    _guard_draft(invoice)

    amount = _calc_amount(body, invoice)

    if body.row_no is None:
        result = await db.execute(
            select(func.count(InvoiceDeduction.id))
            .where(InvoiceDeduction.invoice_id == invoice_id, InvoiceDeduction.is_deleted.is_(False))
        )
        row_no = (result.scalar() or 0) + 1
    else:
        row_no = body.row_no

    deduction = InvoiceDeduction(
        invoice_id=invoice_id,
        deduction_type=body.deduction_type,
        description=body.description,
        amount=amount,
        calculation_rate=body.calculation_rate,
        row_no=row_no,
    )
    db.add(deduction)
    await db.flush()

    await _recalculate_totals(invoice, db)
    await record_history(
        db, entity_type="invoice", entity_id=invoice_id,
        change_type=EditHistoryChangeType.update,
        field_changes={"deductions": {
            "before": None,
            "after": {"type": body.deduction_type.value, "amount": amount},
        }},
        user_id=user_id,
    )
    await db.commit()
    await db.refresh(deduction)
    return _to_deduction_read(deduction)


# ── 控除 更新 ───────────────────────────────────────────────────────────────

async def update_deduction(
    project_id: uuid.UUID,
    invoice_id: uuid.UUID,
    deduction_id: uuid.UUID,
    body: InvoiceDeductionUpdate,
    db: AsyncSession,
    user_id: uuid.UUID,
) -> InvoiceDeductionRead:
    """控除項目を更新する。"""
    invoice = await _get_invoice_or_404(invoice_id, project_id, db)
    _guard_draft(invoice)

    deduction = await db.get(InvoiceDeduction, deduction_id)
    if deduction is None or deduction.invoice_id != invoice_id or deduction.is_deleted:
        raise HTTPException(status_code=404, detail="控除項目が見つかりません")

    if body.description is not None:
        deduction.description = body.description
    if body.row_no is not None:
        deduction.row_no = body.row_no
    if body.calculation_rate is not None or body.amount is not None:
        deduction.amount = _calc_amount(body, invoice)
        deduction.calculation_rate = body.calculation_rate

    await _recalculate_totals(invoice, db)
    await db.commit()
    await db.refresh(deduction)
    return _to_deduction_read(deduction)


# ── 控除 削除（論理削除） ───────────────────────────────────────────────────

async def remove_deduction(
    project_id: uuid.UUID,
    invoice_id: uuid.UUID,
    deduction_id: uuid.UUID,
    db: AsyncSession,
    user_id: uuid.UUID,
) -> None:
    """控除項目を論理削除する。"""
    invoice = await _get_invoice_or_404(invoice_id, project_id, db)
    _guard_draft(invoice)

    deduction = await db.get(InvoiceDeduction, deduction_id)
    if deduction is None or deduction.invoice_id != invoice_id or deduction.is_deleted:
        raise HTTPException(status_code=404, detail="控除項目が見つかりません")

    before_snapshot = {"type": deduction.deduction_type.value, "amount": float(deduction.amount)}
    deduction.is_deleted = True

    await _recalculate_totals(invoice, db)
    await record_history(
        db, entity_type="invoice", entity_id=invoice_id,
        change_type=EditHistoryChangeType.update,
        field_changes={"deductions": {"before": before_snapshot, "after": None}},
        user_id=user_id,
    )
    await db.commit()


# ── 出来高サマリー ─────────────────────────────────────────────────────────

async def get_progress_summary(
    project_id: uuid.UUID,
    db: AsyncSession,
) -> ProgressSummaryResponse:
    """案件の累計請求額・残高を動的に計算して返す。"""
    result = await db.execute(
        select(func.sum(Invoice.current_purchase))
        .where(
            Invoice.project_id == project_id,
            Invoice.status.in_([InvoiceStatus.sent, InvoiceStatus.paid]),
            Invoice.current_purchase.is_not(None),
        )
    )
    cumulative = float(result.scalar() or 0)

    draft_result = await db.execute(
        select(Invoice.current_purchase, Invoice.contract_amount_snapshot)
        .where(Invoice.project_id == project_id, Invoice.status == InvoiceStatus.draft)
        .order_by(Invoice.created_at.desc())
        .limit(1)
    )
    draft_row = draft_result.first()
    current = float(draft_row.current_purchase or 0) if draft_row else None
    contract = float(draft_row.contract_amount_snapshot or 0) if draft_row else None

    outstanding = (contract - cumulative - (current or 0)) if contract else None
    progress_percent: float | None = None
    if contract and contract > 0:
        progress_percent = round(cumulative / contract * 100, 1)

    return ProgressSummaryResponse(
        contract_amount=contract,
        cumulative_billed=cumulative,
        current_purchase=current,
        outstanding_contract=outstanding,
        progress_percent=progress_percent,
    )
