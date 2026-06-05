"""発注・仕入管理 API。"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.purchase import PurchaseOrder, PurchaseOrderItem, VendorDelivery
from app.models.enums import DeliveryStatus, PurchaseOrderStatus
from app.models.project import Project
from app.models.user import User

logger = structlog.get_logger()
router = APIRouter()


# ── Pydantic スキーマ ─────────────────────────────────────────

class OrderItemCreate(BaseModel):
    item_name: str
    spec: str | None = None
    unit: str | None = None
    quantity: Decimal = Decimal("1")
    unit_price: Decimal = Decimal("0")
    amount: Decimal = Decimal("0")
    row_no: int = 0


class OrderItemRead(BaseModel):
    id: uuid.UUID
    purchase_order_id: uuid.UUID
    row_no: int
    item_name: str
    spec: str | None
    unit: str | None
    quantity: Decimal
    unit_price: Decimal
    amount: Decimal
    delivered_quantity: Decimal
    delivery_status: DeliveryStatus

    model_config = {"from_attributes": True}


class DeliveryCreate(BaseModel):
    delivered_at: datetime
    quantity: Decimal
    note: str | None = None


class DeliveryRead(BaseModel):
    id: uuid.UUID
    purchase_order_item_id: uuid.UUID
    delivered_at: datetime
    quantity: Decimal
    received_by: uuid.UUID
    note: str | None

    model_config = {"from_attributes": True}


class PurchaseOrderCreate(BaseModel):
    vendor_id: uuid.UUID
    qcds_direct_work_id: uuid.UUID | None = None
    order_date: date | None = None
    delivery_date: date | None = None
    payment_due_date: date | None = None
    delivery_address: str | None = None
    items: list[OrderItemCreate] = []


class PurchaseOrderUpdate(BaseModel):
    order_date: date | None = None
    delivery_date: date | None = None
    payment_due_date: date | None = None
    delivery_address: str | None = None
    status: PurchaseOrderStatus | None = None


class PurchaseOrderRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    vendor_id: uuid.UUID
    qcds_direct_work_id: uuid.UUID | None
    order_number: str | None
    order_date: date | None
    delivery_date: date | None
    payment_due_date: date | None = None
    paid_at: datetime | None = None
    delivery_address: str | None
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    status: PurchaseOrderStatus
    issued_at: datetime | None
    created_by: uuid.UUID
    items: list[OrderItemRead] = []
    vendor_name: str | None = None
    project_name: str | None = None
    project_number: str | None = None

    model_config = {"from_attributes": True}


# ── ヘルパー ─────────────────────────────────────────────────

async def _get_project_or_404(project_id: uuid.UUID, db: AsyncSession) -> Project:
    p = await db.get(Project, project_id)
    if p is None or p.deleted_at is not None:
        raise HTTPException(status_code=404, detail="案件が見つかりません")
    return p


def _calc_totals(items: list[PurchaseOrderItem]) -> tuple[Decimal, Decimal, Decimal]:
    subtotal = sum(i.amount for i in items)
    tax = (subtotal * Decimal("0.1")).quantize(Decimal("1"))
    return subtotal, tax, subtotal + tax


async def _to_read(order: PurchaseOrder, db: AsyncSession) -> PurchaseOrderRead:
    _skip = {"vendor_name", "project_name", "project_number", "items", "payment_due_date", "paid_at"}
    return PurchaseOrderRead(
        **{k: getattr(order, k) for k in PurchaseOrderRead.model_fields if hasattr(order, k) and k not in _skip},
        items=[OrderItemRead.model_validate(i) for i in order.items],
        vendor_name=order.vendor.vendor_name if order.vendor else None,
        project_name=order.project.project_name if getattr(order, "project", None) else None,
        project_number=order.project.project_number if getattr(order, "project", None) else None,
        payment_due_date=getattr(order, "payment_due_date", None),
        paid_at=getattr(order, "paid_at", None),
    )


# ── エンドポイント ────────────────────────────────────────────

@router.get("/purchase-orders/all", response_model=list[PurchaseOrderRead])
async def list_all_orders(
    status_filter: PurchaseOrderStatus | None = None,
    vendor_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PurchaseOrderRead]:
    """全案件横断の発注書一覧。ステータス・業者でフィルタ可能。"""
    q = (
        select(PurchaseOrder)
        .options(
            selectinload(PurchaseOrder.items),
            selectinload(PurchaseOrder.vendor),
            selectinload(PurchaseOrder.project),
        )
        .join(Project, PurchaseOrder.project_id == Project.id)
        .where(Project.deleted_at.is_(None))
        .order_by(PurchaseOrder.created_at.desc())
    )
    if status_filter:
        q = q.where(PurchaseOrder.status == status_filter)
    if vendor_id:
        q = q.where(PurchaseOrder.vendor_id == vendor_id)
    result = await db.execute(q)
    orders = result.scalars().all()
    return [await _to_read(o, db) for o in orders]


@router.get("/projects/{project_id}/purchase-orders", response_model=list[PurchaseOrderRead])
async def list_orders(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PurchaseOrderRead]:
    """発注書一覧。"""
    await _get_project_or_404(project_id, db)
    result = await db.execute(
        select(PurchaseOrder)
        .options(
            selectinload(PurchaseOrder.items),
            selectinload(PurchaseOrder.vendor),
            selectinload(PurchaseOrder.project),
        )
        .where(PurchaseOrder.project_id == project_id)
        .order_by(PurchaseOrder.created_at.desc())
    )
    orders = result.scalars().all()
    return [await _to_read(o, db) for o in orders]


@router.get("/purchase-orders/upcoming-payments", response_model=list[PurchaseOrderRead])
async def upcoming_payments(
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PurchaseOrderRead]:
    """支払期日が近い発注書一覧（カレンダー用）。"""
    from datetime import date as date_type, timedelta
    today = date_type.today()
    limit_date = today + timedelta(days=days)
    result = await db.execute(
        select(PurchaseOrder)
        .options(
            selectinload(PurchaseOrder.items),
            selectinload(PurchaseOrder.vendor),
            selectinload(PurchaseOrder.project),
        )
        .join(Project, PurchaseOrder.project_id == Project.id)
        .where(Project.deleted_at.is_(None))
        .where(PurchaseOrder.payment_due_date.isnot(None))
        .where(PurchaseOrder.payment_due_date >= today)
        .where(PurchaseOrder.payment_due_date <= limit_date)
        .where(PurchaseOrder.status != PurchaseOrderStatus.completed)
        .order_by(PurchaseOrder.payment_due_date)
    )
    orders = result.scalars().all()
    return [await _to_read(o, db) for o in orders]


@router.get("/purchase-orders/{order_id}", response_model=PurchaseOrderRead)
async def get_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PurchaseOrderRead:
    """発注書詳細。"""
    result = await db.execute(
        select(PurchaseOrder)
        .options(
            selectinload(PurchaseOrder.items),
            selectinload(PurchaseOrder.vendor),
            selectinload(PurchaseOrder.project),
        )
        .where(PurchaseOrder.id == order_id)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="発注書が見つかりません")
    return await _to_read(order, db)


@router.post("/projects/{project_id}/purchase-orders", response_model=PurchaseOrderRead, status_code=status.HTTP_201_CREATED)
async def create_order(
    project_id: uuid.UUID,
    body: PurchaseOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PurchaseOrderRead:
    """発注書作成。"""
    await _get_project_or_404(project_id, db)
    order = PurchaseOrder(
        project_id=project_id,
        created_by=current_user.id,
        vendor_id=body.vendor_id,
        qcds_direct_work_id=body.qcds_direct_work_id,
        payment_due_date=body.payment_due_date,
        order_date=body.order_date,
        delivery_date=body.delivery_date,
        delivery_address=body.delivery_address,
    )
    db.add(order)
    await db.flush()
    items = []
    for item_data in body.items:
        item = PurchaseOrderItem(purchase_order_id=order.id, **item_data.model_dump())
        db.add(item)
        items.append(item)
    await db.flush()
    subtotal, tax, total = _calc_totals(items)
    order.subtotal = subtotal
    order.tax_amount = tax
    order.total_amount = total
    await db.commit()
    # 取決金額自動連動
    if order.vendor_id:
        from app.shared.services.qcds_sync import sync_agreed_amount_from_orders
        await sync_agreed_amount_from_orders(db, project_id, order.vendor_id)
        await db.commit()
    return await get_order(order.id, db, current_user)


@router.patch("/purchase-orders/{order_id}", response_model=PurchaseOrderRead)
async def update_order(
    order_id: uuid.UUID,
    body: PurchaseOrderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PurchaseOrderRead:
    """発注書更新。"""
    order = await db.get(PurchaseOrder, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="発注書が見つかりません")
    vendor_id_before = order.vendor_id
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(order, field, value)
    await db.commit()
    # 取決金額自動連動（vendor が変わった場合は旧 vendor も更新）
    if order.vendor_id and order.project_id:
        from app.shared.services.qcds_sync import sync_agreed_amount_from_orders
        await sync_agreed_amount_from_orders(db, order.project_id, order.vendor_id)
        if vendor_id_before and vendor_id_before != order.vendor_id:
            await sync_agreed_amount_from_orders(db, order.project_id, vendor_id_before)
        await db.commit()
    return await get_order(order_id, db, current_user)


async def _sync_after_status_change(db, order: PurchaseOrder) -> None:
    """ステータス変更後に取決金額を同期する共通ヘルパー。"""
    if order.vendor_id and order.project_id:
        from app.shared.services.qcds_sync import sync_agreed_amount_from_orders
        await sync_agreed_amount_from_orders(db, order.project_id, order.vendor_id)
        await db.commit()


@router.post("/purchase-orders/{order_id}/issue", response_model=PurchaseOrderRead)
async def issue_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PurchaseOrderRead:
    """発注書を発行（issued_at を設定、ステータスを issued に）。"""
    order = await db.get(PurchaseOrder, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="発注書が見つかりません")
    order.status = PurchaseOrderStatus.issued
    order.issued_at = datetime.now(timezone.utc)
    await db.commit()
    await _sync_after_status_change(db, order)
    return await get_order(order_id, db, current_user)


@router.put("/purchase-orders/{order_id}", response_model=PurchaseOrderRead)
async def replace_order(
    order_id: uuid.UUID,
    body: PurchaseOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PurchaseOrderRead:
    """発注書全体更新（ヘッダ＋明細全置換）。下書きのみ可。"""
    order = await db.get(PurchaseOrder, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="発注書が見つかりません")
    if order.status != PurchaseOrderStatus.draft:
        raise HTTPException(status_code=400, detail="発行済の発注書は編集できません")
    order.vendor_id = body.vendor_id
    order.order_date = body.order_date
    order.delivery_date = body.delivery_date
    order.payment_due_date = body.payment_due_date
    order.delivery_address = body.delivery_address
    # 既存明細を削除して再作成
    existing = await db.execute(select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == order_id))
    for item in existing.scalars().all():
        await db.delete(item)
    await db.flush()
    new_items = []
    for item_data in body.items:
        item = PurchaseOrderItem(purchase_order_id=order.id, **item_data.model_dump())
        db.add(item)
        new_items.append(item)
    await db.flush()
    subtotal, tax, total = _calc_totals(new_items)
    order.subtotal = subtotal
    order.tax_amount = tax
    order.total_amount = total
    await db.commit()
    return await get_order(order_id, db, current_user)


@router.post("/purchase-orders/{order_id}/mark-delivered", response_model=PurchaseOrderRead)
async def mark_delivered(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PurchaseOrderRead:
    """納品済にする。"""
    order = await db.get(PurchaseOrder, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="発注書が見つかりません")
    order.status = PurchaseOrderStatus.delivered
    await db.commit()
    await _sync_after_status_change(db, order)
    return await get_order(order_id, db, current_user)


@router.post("/purchase-orders/{order_id}/mark-paid", response_model=PurchaseOrderRead)
async def mark_paid(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PurchaseOrderRead:
    """支払済にする。"""
    order = await db.get(PurchaseOrder, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="発注書が見つかりません")
    order.status = PurchaseOrderStatus.delivered  # delivered が最終ステータス
    order.paid_at = datetime.now(timezone.utc)
    await db.commit()
    await _sync_after_status_change(db, order)
    return await get_order(order_id, db, current_user)


@router.delete("/purchase-orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """発注書削除（明細ごと削除）。"""
    order = await db.get(PurchaseOrder, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="発注書が見つかりません")
    vendor_id = order.vendor_id
    project_id = order.project_id
    await db.delete(order)
    await db.commit()
    # 削除後に取決金額を再計算
    if vendor_id and project_id:
        from app.shared.services.qcds_sync import sync_agreed_amount_from_orders
        await sync_agreed_amount_from_orders(db, project_id, vendor_id)
        await db.commit()


@router.post("/purchase-orders/{order_id}/items/{item_id}/deliveries", response_model=DeliveryRead, status_code=status.HTTP_201_CREATED)
async def record_delivery(
    order_id: uuid.UUID,
    item_id: uuid.UUID,
    body: DeliveryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeliveryRead:
    """納品記録。"""
    item = await db.get(PurchaseOrderItem, item_id)
    if item is None or item.purchase_order_id != order_id:
        raise HTTPException(status_code=404, detail="発注明細が見つかりません")
    delivery = VendorDelivery(
        purchase_order_item_id=item_id,
        received_by=current_user.id,
        **body.model_dump(),
    )
    db.add(delivery)
    item.delivered_quantity += body.quantity
    if item.delivered_quantity >= item.quantity:
        item.delivery_status = DeliveryStatus.delivered
    else:
        item.delivery_status = DeliveryStatus.partial
    await db.commit()
    await db.refresh(delivery)
    return DeliveryRead.model_validate(delivery)
