"""請求書エンドポイント。"""
from __future__ import annotations

import uuid
from math import floor

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.enums import InvoiceStatus, ProjectStatus
from app.models.invoice import Invoice, InvoiceItem, Payment
from app.models.project import Project
from app.models.user import User
from app.schemas.invoice import (
    InvoiceCreate,
    InvoiceRead,
    InvoiceSummary,
    InvoiceUpdate,
    InvoiceItemRead,
    PaymentCreate,
    PaymentRead,
)

router = APIRouter(tags=["invoices"])
logger = structlog.get_logger(__name__)


def _to_read(inv: Invoice) -> InvoiceRead:
    return InvoiceRead(
        id=inv.id,
        project_id=inv.project_id,
        invoice_number=inv.invoice_number,
        issue_date=inv.issue_date,
        previous_balance=float(inv.previous_balance) if inv.previous_balance is not None else None,
        received_amount=float(inv.received_amount) if inv.received_amount is not None else None,
        outstanding_balance=float(inv.outstanding_balance) if inv.outstanding_balance is not None else None,
        current_purchase=float(inv.current_purchase) if inv.current_purchase is not None else None,
        tax_amount=float(inv.tax_amount) if inv.tax_amount is not None else None,
        total_amount=float(inv.total_amount) if inv.total_amount is not None else None,
        quote_id=inv.quote_id,
        linked_to_quote=inv.linked_to_quote,
        status=inv.status,
        billing_method=inv.billing_method,
        billing_percentage=float(inv.billing_percentage) if inv.billing_percentage is not None else None,
        billing_note=inv.billing_note,
        payment_due_date=inv.payment_due_date,
        split_sequence=inv.split_sequence,
        split_total=inv.split_total,
        invoice_type=inv.invoice_type,
        parent_invoice_id=inv.parent_invoice_id,
        work_description=inv.work_description,
        work_remarks=inv.work_remarks,
        completion_date=inv.completion_date,
        items=[
            InvoiceItemRead(
                id=i.id, row_no=i.row_no, item_name=i.item_name,
                amount=float(i.amount) if i.amount is not None else None,
                remarks=i.remarks, description=i.description,
            )
            for i in inv.items
        ],
        payments=[
            PaymentRead(
                id=p.id, invoice_id=p.invoice_id,
                amount=float(p.amount),
                payment_date=p.payment_date,
                payment_method=p.payment_method,
                note=p.note,
                target_split_id=p.target_split_id,
                created_at=p.created_at,
            )
            for p in inv.payments
        ],
        created_at=inv.created_at,
        updated_at=inv.updated_at,
    )


def _calc_totals(inv: Invoice, extra_amount: float = 0.0) -> None:
    """請求書の税額・合計・差引残高を再計算する（追記行の金額を含む）。"""
    purchase = float(inv.current_purchase or 0) + extra_amount
    prev = float(inv.previous_balance or 0)
    received = float(inv.received_amount or 0)
    inv.outstanding_balance = prev - received
    inv.tax_amount = floor(purchase * 0.10)
    inv.total_amount = purchase + floor(purchase * 0.10)


def _load_options():
    return (
        selectinload(Invoice.items),
        selectinload(Invoice.payments),
    )


@router.get("/projects/{project_id}/invoices", response_model=list[InvoiceRead])
async def list_invoices(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[InvoiceRead]:
    """案件の請求書一覧を返す。"""
    project = (await db.execute(
        select(Project).where(Project.id == project_id, Project.deleted_at == None)  # noqa: E711
    )).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件が見つかりません")

    invoices = (await db.execute(
        select(Invoice)
        .options(*_load_options())
        .where(Invoice.project_id == project_id)
        .order_by(Invoice.created_at.asc())
    )).scalars().all()
    return [_to_read(inv) for inv in invoices]


@router.post("/projects/{project_id}/invoices", response_model=InvoiceRead, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    project_id: uuid.UUID,
    body: InvoiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InvoiceRead:
    """請求書を作成する。請求番号は {工事番号}-請{連番} で自動採番する。"""
    project = (await db.execute(
        select(Project).where(Project.id == project_id, Project.deleted_at == None)  # noqa: E711
    )).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件が見つかりません")

    count = (await db.execute(
        select(func.count(Invoice.id)).where(Invoice.project_id == project_id)
    )).scalar_one()
    invoice_number = f"{project.project_number}-請{count + 1}"

    inv = Invoice(
        project_id=project_id,
        invoice_number=invoice_number,
        issue_date=body.issue_date,
        previous_balance=body.previous_balance,
        received_amount=body.received_amount,
        current_purchase=body.current_purchase,
        billing_method=body.billing_method,
        billing_percentage=body.billing_percentage,
        billing_note=body.billing_note,
        payment_due_date=body.payment_due_date,
    )
    _calc_totals(inv)
    db.add(inv)
    await db.flush()

    for item in body.items:
        db.add(InvoiceItem(
            invoice_id=inv.id,
            row_no=item.row_no,
            item_name=item.item_name,
            amount=item.amount,
            remarks=item.remarks,
            description=item.description,
        ))

    await db.commit()
    inv = (await db.execute(
        select(Invoice).options(*_load_options()).where(Invoice.id == inv.id)
    )).scalar_one()
    return _to_read(inv)


@router.get("/projects/{project_id}/invoices/{invoice_id}", response_model=InvoiceRead)
async def get_invoice(
    project_id: uuid.UUID,
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InvoiceRead:
    """請求書詳細を返す。"""
    inv = (await db.execute(
        select(Invoice)
        .options(*_load_options())
        .where(Invoice.id == invoice_id, Invoice.project_id == project_id)
    )).scalar_one_or_none()
    if inv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="請求書が見つかりません")
    return _to_read(inv)


@router.patch("/projects/{project_id}/invoices/{invoice_id}", response_model=InvoiceRead)
async def update_invoice(
    project_id: uuid.UUID,
    invoice_id: uuid.UUID,
    body: InvoiceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InvoiceRead:
    """請求書を更新する。"""
    inv = (await db.execute(
        select(Invoice)
        .options(*_load_options())
        .where(Invoice.id == invoice_id, Invoice.project_id == project_id)
    )).scalar_one_or_none()
    if inv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="請求書が見つかりません")

    for field in (
        "issue_date", "previous_balance", "received_amount", "current_purchase",
        "status", "billing_method", "billing_percentage", "billing_note", "payment_due_date",
        "work_description", "work_remarks", "completion_date",
    ):
        val = getattr(body, field, None)
        if val is not None:
            setattr(inv, field, val)

    # 追記行（items）の金額合計を計算して total_amount に反映
    extra_amount = sum(float(item.amount or 0) for item in (body.items or []))
    _calc_totals(inv, extra_amount=extra_amount)

    if body.items is not None:
        for old in list(inv.items):
            await db.delete(old)
        await db.flush()
        for item in body.items:
            db.add(InvoiceItem(
                invoice_id=inv.id,
                row_no=item.row_no,
                item_name=item.item_name,
                amount=item.amount,
                remarks=item.remarks,
                description=item.description,
            ))

    await db.commit()
    inv = (await db.execute(
        select(Invoice).options(*_load_options()).where(Invoice.id == invoice_id)
    )).scalar_one()
    return _to_read(inv)


@router.post("/projects/{project_id}/invoices/{invoice_id}/pay", response_model=InvoiceRead)
async def pay_invoice(
    project_id: uuid.UUID,
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InvoiceRead:
    """請求書を入金済みにする。案件ステータスも更新する。"""
    inv = (await db.execute(
        select(Invoice)
        .options(*_load_options())
        .where(Invoice.id == invoice_id, Invoice.project_id == project_id)
    )).scalar_one_or_none()
    if inv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="請求書が見つかりません")

    inv.status = InvoiceStatus.paid

    project = (await db.execute(
        select(Project).where(Project.id == project_id)
    )).scalar_one()
    if project.status == ProjectStatus.invoiced:
        project.status = ProjectStatus.paid

    await db.commit()
    inv = (await db.execute(
        select(Invoice).options(*_load_options()).where(Invoice.id == invoice_id)
    )).scalar_one()
    return _to_read(inv)


@router.patch("/projects/{project_id}/invoices/{invoice_id}/unlink", response_model=InvoiceRead)
async def unlink_invoice_from_quote(
    project_id: uuid.UUID,
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InvoiceRead:
    """請求書の見積連動を解除し、独立編集モードにする。"""
    inv = (await db.execute(
        select(Invoice)
        .options(*_load_options())
        .where(Invoice.id == invoice_id, Invoice.project_id == project_id)
    )).scalar_one_or_none()
    if inv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="請求書が見つかりません")

    inv.linked_to_quote = False
    await db.commit()
    inv = (await db.execute(
        select(Invoice).options(*_load_options()).where(Invoice.id == invoice_id)
    )).scalar_one()
    return _to_read(inv)


@router.post(
    "/projects/{project_id}/invoices/{invoice_id}/auto-split",
    response_model=list[InvoiceRead],
    status_code=status.HTTP_201_CREATED,
)
async def auto_split_invoice(
    project_id: uuid.UUID,
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[InvoiceRead]:
    """総額請求書＋分割連動型に変換する。

    例: 25% → 総額1枚 + 分割4枚 (25/25/25/25)
        30% → 総額1枚 + 分割3枚 (30/30/40)
    """
    inv = (await db.execute(
        select(Invoice).options(*_load_options())
        .where(Invoice.id == invoice_id, Invoice.project_id == project_id)
    )).scalar_one_or_none()
    if inv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="請求書が見つかりません")
    if not inv.billing_percentage or float(inv.billing_percentage) <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="割合(%)を設定・保存してから自動分割してください")
    if inv.invoice_type == "total":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="すでに自動分割済みです（総額請求書に変換済み）")

    project = (await db.execute(
        select(Project).where(Project.id == project_id)
    )).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件が見つかりません")

    pct = float(inv.billing_percentage)
    n_total = int(100 / pct)
    last_pct = 100.0 - (n_total - 1) * pct

    # 顧客見積の税抜合計を取得（分割金額の基準）
    from app.models.quote import Quote
    quote_subtotal: float | None = None
    quote_row = (await db.execute(
        select(Quote.subtotal).where(Quote.project_id == project_id)
        .order_by(Quote.created_at.desc()).limit(1)
    )).scalar_one_or_none()
    if quote_row is not None:
        quote_subtotal = float(quote_row)

    # 現在の請求書 → 総額請求書 (total) に変換
    inv.invoice_type = "total"
    inv.split_total = n_total
    inv.split_sequence = None  # total には sequence 不要
    if quote_subtotal:
        inv.current_purchase = quote_subtotal  # 総額は税抜合計をそのまま
        _calc_totals(inv)

    # 採番用カウント
    count_now = (await db.execute(
        select(func.count(Invoice.id)).where(Invoice.project_id == project_id)
    )).scalar_one()

    # 分割請求書 1〜n 枚を作成
    split_children = []
    each_purchase = int(quote_subtotal * pct / 100) if quote_subtotal else None
    for i in range(1, n_total + 1):
        this_pct = last_pct if i == n_total else pct
        if quote_subtotal:
            if i == n_total:
                already = int(quote_subtotal * pct / 100) * (n_total - 1)
                purchase_amount = int(quote_subtotal - already)
            else:
                purchase_amount = int(quote_subtotal * pct / 100)
        else:
            purchase_amount = None

        seq_no = count_now + i
        child = Invoice(
            project_id=project_id,
            invoice_number=f"{project.project_number}-請{seq_no}",
            billing_method=inv.billing_method,
            billing_percentage=this_pct,
            billing_note=inv.billing_note,
            current_purchase=purchase_amount,
            invoice_type="split",
            parent_invoice_id=inv.id,
            split_sequence=i,
            split_total=n_total,
        )
        _calc_totals(child)
        db.add(child)
        split_children.append(child)

    await db.commit()

    total_inv = (await db.execute(
        select(Invoice).options(*_load_options()).where(Invoice.id == invoice_id)
    )).scalar_one()
    all_results = [total_inv]
    for c in split_children:
        refreshed = (await db.execute(
            select(Invoice).options(*_load_options()).where(Invoice.id == c.id)
        )).scalar_one()
        all_results.append(refreshed)

    return [_to_read(r) for r in all_results]


@router.delete(
    "/projects/{project_id}/invoices/{invoice_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_invoice(
    project_id: uuid.UUID,
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """請求書を削除する（入金済みは削除不可）。"""
    inv = (await db.execute(
        select(Invoice)
        .options(*_load_options())
        .where(Invoice.id == invoice_id, Invoice.project_id == project_id)
    )).scalar_one_or_none()
    if inv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="請求書が見つかりません")
    if inv.status == InvoiceStatus.paid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="入金済みの請求書は削除できません")

    for p in list(inv.payments):
        await db.delete(p)
    for item in list(inv.items):
        await db.delete(item)
    await db.delete(inv)
    await db.commit()


# ---------------------------------------------------------------------------
# 入金記録エンドポイント
# ---------------------------------------------------------------------------

@router.post(
    "/projects/{project_id}/invoices/{invoice_id}/payments",
    response_model=PaymentRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_payment(
    project_id: uuid.UUID,
    invoice_id: uuid.UUID,
    body: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaymentRead:
    """請求書に入金記録を追加する。入金後、ステータスを自動更新する。"""
    inv = (await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.payments))
        .where(Invoice.id == invoice_id, Invoice.project_id == project_id)
    )).scalar_one_or_none()
    if inv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="請求書が見つかりません")

    payment = Payment(
        invoice_id=invoice_id,
        amount=body.amount,
        payment_date=body.payment_date,
        payment_method=body.payment_method,
        note=body.note,
        target_split_id=body.target_split_id,
    )
    db.add(payment)
    await db.flush()

    # 入金合計を計算してステータス自動更新
    total_paid = sum(float(p.amount) for p in inv.payments) + float(body.amount)
    total_billed = float(inv.total_amount or 0)
    if total_billed > 0:
        if total_paid >= total_billed:
            inv.status = InvoiceStatus.paid
        else:
            inv.status = InvoiceStatus.partially_paid

    # 総額請求書からの分割連動: target_split_id がある場合に次の分割請求書を更新
    if body.target_split_id and inv.invoice_type == "total":
        target_split = (await db.execute(
            select(Invoice)
            .options(*_load_options())
            .where(Invoice.id == body.target_split_id)
        )).scalar_one_or_none()

        if target_split:
            # 対象回のステータス更新
            split_amount = float(target_split.total_amount or 0)
            if float(body.amount) >= split_amount:
                target_split.status = InvoiceStatus.paid
            else:
                target_split.status = InvoiceStatus.partially_paid

            # 次の回の分割請求書を取得して前月繰越を自動更新
            next_seq = (target_split.split_sequence or 0) + 1
            next_split = (await db.execute(
                select(Invoice)
                .where(
                    Invoice.parent_invoice_id == invoice_id,
                    Invoice.split_sequence == next_seq,
                )
            )).scalar_one_or_none()

            if next_split:
                unpaid = max(0.0, split_amount - float(body.amount))
                next_split.previous_balance = split_amount
                next_split.received_amount = float(body.amount)
                # 今回分の税抜額（next_split の元の金額）+ 未払い分
                base_purchase = float(next_split.current_purchase or 0)
                if unpaid > 0:
                    next_split.current_purchase = base_purchase + unpaid
                _calc_totals(next_split)

    await db.commit()
    await db.refresh(payment)

    return PaymentRead(
        id=payment.id,
        invoice_id=payment.invoice_id,
        amount=float(payment.amount),
        payment_date=payment.payment_date,
        payment_method=payment.payment_method,
        note=payment.note,
        target_split_id=payment.target_split_id,
        created_at=payment.created_at,
    )


@router.delete(
    "/projects/{project_id}/invoices/{invoice_id}/payments/{payment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_payment(
    project_id: uuid.UUID,
    invoice_id: uuid.UUID,
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """入金記録を削除する。"""
    payment = (await db.execute(
        select(Payment).where(Payment.id == payment_id, Payment.invoice_id == invoice_id)
    )).scalar_one_or_none()
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="入金記録が見つかりません")

    await db.delete(payment)

    # ステータスを再計算
    inv = (await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.payments))
        .where(Invoice.id == invoice_id)
    )).scalar_one()
    remaining = [p for p in inv.payments if p.id != payment_id]
    total_paid = sum(float(p.amount) for p in remaining)
    total_billed = float(inv.total_amount or 0)
    if total_paid == 0:
        inv.status = InvoiceStatus.sent if inv.status != InvoiceStatus.draft else InvoiceStatus.draft
    elif total_paid < total_billed:
        inv.status = InvoiceStatus.partially_paid

    await db.commit()


# ---------------------------------------------------------------------------
# 案件請求サマリ
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/invoice-summary", response_model=InvoiceSummary)
async def get_invoice_summary(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InvoiceSummary:
    """案件の請求・入金サマリを返す（project_invoice_summary ビュー）。"""
    row = (await db.execute(
        text("SELECT * FROM project_invoice_summary WHERE project_id = :pid"),
        {"pid": str(project_id)},
    )).mappings().first()

    if row is None:
        return InvoiceSummary(
            project_id=project_id,
            invoice_count=0,
            total_billed=0,
            total_paid=0,
            outstanding=0,
            latest_due_date=None,
        )

    return InvoiceSummary(
        project_id=project_id,
        invoice_count=row["invoice_count"],
        total_billed=float(row["total_billed"]),
        total_paid=float(row["total_paid"]),
        outstanding=float(row["outstanding"]),
        latest_due_date=row["latest_due_date"],
    )
