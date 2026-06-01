"""見積書 CRUD・承認・関連帳票生成ルーター。"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.acknowledgment import Acknowledgment
from app.models.enums import AcknowledgmentStatus, OrderStatus, UserRole
from app.models.invoice import Invoice
from app.models.order import Order
from app.models.quote import Quote, QuoteItem
from app.models.user import User
from app.schemas.quote import (
    QuoteApproveStamp,
    QuoteCreate,
    QuoteDetail,
    QuoteListItem,
    QuoteUpdate,
)
from app.services.document_sync_service import sync_dependent_documents_on_quote_change
from app.modules.estimate.routers._helpers import (
    _get_project_or_404,
    _get_quote_or_404,
    _calc_totals,
    _build_detail,
)

router = APIRouter(tags=["quotes"])
logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Quote CRUD
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/quotes", response_model=list[QuoteListItem])
async def list_quotes(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[QuoteListItem]:
    """案件の見積書一覧を返す。"""
    await _get_project_or_404(project_id, db)
    rows = (await db.execute(
        select(Quote).where(Quote.project_id == project_id).order_by(Quote.created_at.desc())
    )).scalars().all()
    return [
        QuoteListItem(
            id=q.id,
            quote_number=q.quote_number,
            issue_date=q.issue_date,
            status=q.status,
            subtotal=float(q.subtotal) if q.subtotal is not None else None,
            tax_amount=float(q.tax_amount) if q.tax_amount is not None else None,
            total_amount=float(q.total_amount) if q.total_amount is not None else None,
            created_at=q.created_at,
        )
        for q in rows
    ]


@router.post("/projects/{project_id}/quotes", response_model=QuoteDetail, status_code=status.HTTP_201_CREATED)
async def create_quote(
    project_id: uuid.UUID,
    body: QuoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuoteDetail:
    """見積書を新規作成する。"""
    project = await _get_project_or_404(project_id, db)
    if not (current_user.role == UserRole.admin or project.created_by == current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="編集権限がありません")

    quote_number = body.quote_number
    if not quote_number:
        existing_count = (await db.execute(
            select(func.count(Quote.id)).where(Quote.project_id == project_id)
        )).scalar_one()
        quote_number = f"{project.project_number}-{existing_count + 1}"

    quote = Quote(
        id=uuid.uuid4(),
        project_id=project_id,
        quote_number=quote_number,
        issue_date=body.issue_date,
        validity_days=body.validity_days,
        project_name_snapshot=body.project_name_snapshot or project.project_name,
        project_location_snapshot=body.project_location_snapshot or project.project_location,
        period_start=body.period_start,
        period_end=body.period_end,
        payment_condition=body.payment_condition,
        remarks=body.remarks,
        conditions_text=body.conditions_text,
        discount_amount=body.discount_amount,
        approver_id=body.approver_id,
        reviewer_id=body.reviewer_id,
        person_in_charge_id=body.person_in_charge_id,
    )
    db.add(quote)
    await db.flush()

    new_items: list[QuoteItem] = []
    for item_in in body.items:
        unit_price = item_in.unit_price
        if unit_price is None and item_in.cost_price is not None:
            unit_price = item_in.cost_price
        amount = None
        if item_in.quantity is not None and unit_price is not None:
            amount = round(item_in.quantity * unit_price)
        item = QuoteItem(
            id=uuid.uuid4(),
            quote_id=quote.id,
            row_no=item_in.row_no,
            item_name=item_in.item_name,
            spec=item_in.spec,
            unit=item_in.unit,
            quantity=item_in.quantity,
            cost_price=item_in.cost_price,
            item_markup_rate=item_in.item_markup_rate,
            unit_price=unit_price,
            amount=amount,
            remarks=item_in.remarks,
            version_id=item_in.version_id,
            section_id=item_in.section_id,
        )
        db.add(item)
        new_items.append(item)

    subtotal, tax_amount, total_amount = _calc_totals(new_items)
    quote.subtotal = subtotal
    quote.tax_amount = tax_amount
    quote.total_amount = total_amount

    await db.commit()
    result = (await db.execute(
        select(Quote)
        .options(selectinload(Quote.versions), selectinload(Quote.sections), selectinload(Quote.items))
        .where(Quote.id == quote.id)
    )).scalar_one()
    logger.info("quote_created", project_id=str(project_id), quote_id=str(quote.id))
    return _build_detail(result)


@router.get("/projects/{project_id}/quotes/{quote_id}", response_model=QuoteDetail)
async def get_quote(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuoteDetail:
    """見積書の詳細を返す。"""
    await _get_project_or_404(project_id, db)
    quote = await _get_quote_or_404(quote_id, project_id, db)
    return _build_detail(quote)


@router.patch("/projects/{project_id}/quotes/{quote_id}", response_model=QuoteDetail)
async def update_quote(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    body: QuoteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuoteDetail:
    """見積書ヘッダを更新する。items が含まれる場合は全置換。"""
    project = await _get_project_or_404(project_id, db)
    if not (current_user.role == UserRole.admin or project.created_by == current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="編集権限がありません")

    quote = await _get_quote_or_404(quote_id, project_id, db)

    for field_name in [
        "quote_number", "issue_date", "validity_days",
        "project_name_snapshot", "project_location_snapshot",
        "period_start", "period_end", "payment_condition",
        "remarks", "conditions_text", "discount_amount",
        "approver_id", "reviewer_id", "person_in_charge_id",
    ]:
        value = getattr(body, field_name)
        if value is not None:
            setattr(quote, field_name, value)

    if body.items is not None:
        existing_map: dict[int, QuoteItem] = {item.row_no: item for item in quote.items}
        incoming_row_nos = {item_in.row_no for item_in in body.items}
        for row_no, item in existing_map.items():
            if row_no not in incoming_row_nos:
                await db.delete(item)

        updated_items: list[QuoteItem] = []
        for item_in in body.items:
            unit_price = item_in.unit_price
            if unit_price is None and item_in.cost_price is not None:
                unit_price = item_in.cost_price
            amount = None
            if item_in.quantity is not None and unit_price is not None:
                amount = round(item_in.quantity * unit_price)

            if item_in.row_no in existing_map:
                item = existing_map[item_in.row_no]
            else:
                item = QuoteItem(id=uuid.uuid4(), quote_id=quote.id, row_no=item_in.row_no)
                db.add(item)

            item.item_name = item_in.item_name
            item.spec = item_in.spec
            item.unit = item_in.unit
            item.quantity = item_in.quantity
            item.cost_price = item_in.cost_price
            item.item_markup_rate = item_in.item_markup_rate
            item.unit_price = unit_price
            item.amount = amount
            item.remarks = item_in.remarks
            item.version_id = item_in.version_id
            item.section_id = item_in.section_id
            updated_items.append(item)

        subtotal, tax_amount, total_amount = _calc_totals(updated_items)
        quote.subtotal = subtotal
        quote.tax_amount = tax_amount
        quote.total_amount = total_amount

    await db.commit()
    await sync_dependent_documents_on_quote_change(quote_id, db)
    await db.commit()
    db.expunge_all()
    result = (await db.execute(
        select(Quote)
        .options(selectinload(Quote.versions), selectinload(Quote.sections), selectinload(Quote.items))
        .where(Quote.id == quote_id)
    )).scalar_one()
    logger.info("quote_updated", project_id=str(project_id), quote_id=str(quote_id))
    return _build_detail(result)


@router.post("/projects/{project_id}/quotes/{quote_id}/approve", response_model=QuoteDetail)
async def stamp_approval(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    body: QuoteApproveStamp,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuoteDetail:
    """稟議承認スタンプを押す／取り消す。権限ロールによる制限あり。"""
    role = current_user.role

    _PERSON_IN_CHARGE_ROLES = {UserRole.staff, UserRole.manager, UserRole.admin, UserRole.super_admin, UserRole.member}
    _REVIEWER_ROLES = {UserRole.manager, UserRole.admin, UserRole.super_admin}
    _APPROVER_ROLES = {UserRole.admin, UserRole.super_admin}

    if body.stamp_type == "person_in_charge" and role not in _PERSON_IN_CHARGE_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="担当確認の権限がありません")
    if body.stamp_type == "reviewer" and role not in _REVIEWER_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="確認押印は上長・管理者のみ可能です")
    if body.stamp_type == "approver" and role not in _APPROVER_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="承認押印は管理者のみ可能です")

    await _get_project_or_404(project_id, db)
    quote = await _get_quote_or_404(quote_id, project_id, db)

    now = datetime.now(timezone.utc) if body.stamp else None

    if body.stamp_type == "person_in_charge":
        quote.person_in_charge_id = body.user_id
        quote.person_in_charge_confirmed_at = now
    elif body.stamp_type == "reviewer":
        quote.reviewer_id = body.user_id
        quote.reviewed_at = now
    elif body.stamp_type == "approver":
        quote.approver_id = body.user_id
        quote.approved_at = now

    await db.commit()
    db.expunge_all()
    result = (await db.execute(
        select(Quote)
        .options(selectinload(Quote.versions), selectinload(Quote.sections), selectinload(Quote.items))
        .where(Quote.id == quote_id)
    )).scalar_one()
    logger.info("quote_stamped", quote_id=str(quote_id), stamp_type=body.stamp_type, stamp=body.stamp)
    return _build_detail(result)


# ---------------------------------------------------------------------------
# 関連帳票一括生成
# ---------------------------------------------------------------------------

@router.post(
    "/projects/{project_id}/quotes/{quote_id}/generate-related-documents",
    status_code=status.HTTP_201_CREATED,
)
async def generate_related_documents(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """見積書から注文書・注文請書・請求書のドラフトを一括生成する。"""
    project = await _get_project_or_404(project_id, db)
    quote = await _get_quote_or_404(quote_id, project_id, db)

    existing_order = (await db.execute(
        select(Order).where(Order.project_id == project_id, Order.quote_id == quote_id)
    )).scalar_one_or_none()

    existing_invoice = (await db.execute(
        select(Invoice).where(Invoice.project_id == project_id, Invoice.quote_id == quote_id)
    )).scalar_one_or_none()

    order_id: uuid.UUID
    invoice_id: uuid.UUID
    ack_id: uuid.UUID | None = None

    if existing_order is not None:
        order_id = existing_order.id
    else:
        order_count = len((await db.execute(
            select(Order).where(Order.project_id == project_id)
        )).scalars().all())
        order = Order(
            project_id=project_id,
            order_number=f"ORD-{order_count + 1:03d}",
            client_company=project.client_name,
            amount_excl_tax=quote.subtotal,
            tax_amount=quote.tax_amount,
            total_amount=quote.total_amount,
            construction_period_start=quote.period_start,
            construction_period_end=quote.period_end,
            payment_condition=quote.payment_condition,
            quote_id=quote_id,
            linked_to_quote=True,
            status=OrderStatus.draft,
        )
        db.add(order)
        await db.flush()
        order_id = order.id

    if existing_invoice is not None:
        invoice_id = existing_invoice.id
    else:
        inv_count = len((await db.execute(
            select(Invoice).where(Invoice.project_id == project_id)
        )).scalars().all())
        invoice = Invoice(
            project_id=project_id,
            invoice_number=f"INV-{inv_count + 1:03d}",
            current_purchase=quote.subtotal,
            tax_amount=quote.tax_amount,
            total_amount=quote.total_amount,
            quote_id=quote_id,
            linked_to_quote=True,
        )
        db.add(invoice)
        await db.flush()
        invoice_id = invoice.id

    existing_ack = (await db.execute(
        select(Acknowledgment).where(Acknowledgment.project_id == project_id, Acknowledgment.order_id == order_id)
    )).scalar_one_or_none()

    if existing_ack is not None:
        ack_id = existing_ack.id
    else:
        ack_count = len((await db.execute(
            select(Acknowledgment).where(Acknowledgment.project_id == project_id)
        )).scalars().all())
        ack = Acknowledgment(
            order_id=order_id,
            project_id=project_id,
            acknowledgment_number=f"ACK-{ack_count + 1:03d}",
            client_company=project.client_name,
            amount_excl_tax=quote.subtotal,
            tax_amount=quote.tax_amount,
            total_amount=quote.total_amount,
            construction_period_start=quote.period_start,
            construction_period_end=quote.period_end,
            payment_condition=quote.payment_condition,
            status=AcknowledgmentStatus.draft,
        )
        db.add(ack)
        await db.flush()
        ack_id = ack.id

    await db.commit()
    logger.info(
        "generated_related_documents",
        project_id=str(project_id),
        quote_id=str(quote_id),
        order_id=str(order_id),
        invoice_id=str(invoice_id),
    )
    return {
        "order_id": str(order_id),
        "acknowledgment_id": str(ack_id),
        "invoice_id": str(invoice_id),
    }
