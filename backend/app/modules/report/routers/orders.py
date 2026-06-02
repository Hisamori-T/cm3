"""注文書エンドポイント。"""
from __future__ import annotations

import uuid
from math import floor

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.acknowledgment import Acknowledgment
from app.models.enums import AcknowledgmentStatus, OrderStatus
from app.models.master import StampTaxTable
from app.models.order import Order
from app.models.project import Project
from app.models.user import User
from app.schemas.acknowledgment import AcknowledgmentRead
from app.schemas.order import OrderCreate, OrderRead, OrderUpdate

router = APIRouter(tags=["orders"])
logger = structlog.get_logger(__name__)

_ORDER_NUMBER_PREFIX = "ORD"


async def _calc_stamp_tax(amount: float, db: AsyncSession) -> float | None:
    """契約金額から印紙税額を計算する。"""
    rows = (await db.execute(
        select(StampTaxTable)
        .where(StampTaxTable.min_amount <= amount)
        .where((StampTaxTable.max_amount == None) | (StampTaxTable.max_amount >= amount))
        .order_by(StampTaxTable.effective_from.desc())
        .limit(1)
    )).scalar_one_or_none()
    return float(rows.tax_amount) if rows else None


def _to_read(o: Order) -> OrderRead:
    return OrderRead(
        id=o.id,
        project_id=o.project_id,
        order_number=o.order_number,
        issue_date=o.issue_date,
        client_address=o.client_address,
        client_company=o.client_company,
        client_person=o.client_person,
        amount_excl_tax=float(o.amount_excl_tax) if o.amount_excl_tax is not None else None,
        tax_amount=float(o.tax_amount) if o.tax_amount is not None else None,
        total_amount=float(o.total_amount) if o.total_amount is not None else None,
        construction_period_start=o.construction_period_start,
        construction_period_end=o.construction_period_end,
        payment_condition=o.payment_condition,
        work_content=o.work_content,
        notes=o.notes,
        terms_and_conditions=o.terms_and_conditions,
        stamp_tax=float(o.stamp_tax) if o.stamp_tax is not None else None,
        quote_id=o.quote_id,
        linked_to_quote=o.linked_to_quote,
        status=o.status,
        created_at=o.created_at,
        updated_at=o.updated_at,
    )


@router.get("/projects/{project_id}/orders", response_model=list[OrderRead])
async def list_orders(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[OrderRead]:
    """案件の注文書一覧を返す。"""
    project = (await db.execute(
        select(Project).where(Project.id == project_id, Project.deleted_at == None)
    )).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件が見つかりません")

    orders = (await db.execute(
        select(Order).where(Order.project_id == project_id)
        .order_by(Order.created_at.desc())
    )).scalars().all()
    return [_to_read(o) for o in orders]


@router.post("/projects/{project_id}/orders", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
async def create_order(
    project_id: uuid.UUID,
    body: OrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OrderRead:
    """注文書を作成する。金額から印紙税を自動算定する。"""
    project = (await db.execute(
        select(Project).where(Project.id == project_id, Project.deleted_at == None)
    )).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件が見つかりません")

    # 注文番号の採番
    count = (await db.execute(
        select(Order).where(Order.project_id == project_id)
    )).scalars().all()
    order_number = f"{_ORDER_NUMBER_PREFIX}-{len(count) + 1:03d}"

    # 税額・合計の計算
    tax_amount = None
    total_amount = None
    if body.amount_excl_tax is not None:
        tax_amount = floor(body.amount_excl_tax * 0.10)
        total_amount = body.amount_excl_tax + tax_amount

    # 印紙税の自動算定
    stamp_tax = None
    if total_amount is not None:
        stamp_tax = await _calc_stamp_tax(total_amount, db)

    order = Order(
        project_id=project_id,
        order_number=order_number,
        issue_date=body.issue_date,
        client_address=body.client_address,
        client_company=body.client_company,
        client_person=body.client_person,
        amount_excl_tax=body.amount_excl_tax,
        tax_amount=tax_amount,
        total_amount=total_amount,
        construction_period_start=body.construction_period_start,
        construction_period_end=body.construction_period_end,
        payment_condition=body.payment_condition,
        work_content=body.work_content,
        notes=body.notes,
        terms_and_conditions=body.terms_and_conditions,
        stamp_tax=stamp_tax,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return _to_read(order)


@router.get("/projects/{project_id}/orders/{order_id}", response_model=OrderRead)
async def get_order(
    project_id: uuid.UUID,
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OrderRead:
    """注文書詳細を返す。"""
    order = (await db.execute(
        select(Order).where(Order.id == order_id, Order.project_id == project_id)
    )).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注文書が見つかりません")
    return _to_read(order)


@router.patch("/projects/{project_id}/orders/{order_id}", response_model=OrderRead)
async def update_order(
    project_id: uuid.UUID,
    order_id: uuid.UUID,
    body: OrderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OrderRead:
    """注文書を更新する。金額変更時は印紙税を再算定する。"""
    order = (await db.execute(
        select(Order).where(Order.id == order_id, Order.project_id == project_id)
    )).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注文書が見つかりません")

    for field in ("issue_date", "client_address", "client_company", "client_person",
                  "construction_period_start", "construction_period_end",
                  "payment_condition", "work_content", "notes",
                  "terms_and_conditions", "status"):
        val = getattr(body, field, None)
        if val is not None:
            setattr(order, field, val)

    if body.amount_excl_tax is not None:
        order.amount_excl_tax = body.amount_excl_tax
        order.tax_amount = floor(body.amount_excl_tax * 0.10)
        order.total_amount = body.amount_excl_tax + floor(body.amount_excl_tax * 0.10)
        order.stamp_tax = await _calc_stamp_tax(float(order.total_amount), db)

    await db.commit()
    await db.refresh(order)
    return _to_read(order)


@router.post(
    "/projects/{project_id}/orders/{order_id}/issue-acknowledgment",
    response_model=AcknowledgmentRead,
    status_code=status.HTTP_201_CREATED,
)
async def issue_acknowledgment(
    project_id: uuid.UUID,
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AcknowledgmentRead:
    """注文書 sent/signed 状態から注文請書を発行する。既存の注文請書がある場合はそれを返す。"""
    order = (await db.execute(
        select(Order).where(Order.id == order_id, Order.project_id == project_id)
    )).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注文書が見つかりません")
    if order.status not in (OrderStatus.sent, OrderStatus.signed):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="注文請書を発行するには注文書のステータスが '発行済み' または 'サイン受領済み' である必要があります",
        )

    existing = (await db.execute(
        select(Acknowledgment).where(Acknowledgment.order_id == order_id)
    )).scalar_one_or_none()
    if existing is not None:
        return _ack_to_read(existing)

    count = len((await db.execute(
        select(Acknowledgment).where(Acknowledgment.project_id == project_id)
    )).scalars().all())
    ack_number = f"ACK-{count + 1:03d}"

    stamp_tax = await _calc_stamp_tax(float(order.total_amount or 0), db) if order.total_amount else None

    ack = Acknowledgment(
        order_id=order_id,
        project_id=project_id,
        acknowledgment_number=ack_number,
        issue_date=order.issue_date,
        client_address=order.client_address,
        client_company=order.client_company,
        client_person=order.client_person,
        amount_excl_tax=order.amount_excl_tax,
        tax_amount=order.tax_amount,
        total_amount=order.total_amount,
        stamp_tax=stamp_tax,
        construction_period_start=order.construction_period_start,
        construction_period_end=order.construction_period_end,
        payment_condition=order.payment_condition,
        terms_and_conditions=order.terms_and_conditions,
        status=AcknowledgmentStatus.draft,
    )
    db.add(ack)
    await db.commit()
    await db.refresh(ack)
    return _ack_to_read(ack)


@router.patch("/projects/{project_id}/orders/{order_id}/unlink", response_model=OrderRead)
async def unlink_order_from_quote(
    project_id: uuid.UUID,
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OrderRead:
    """注文書の見積連動を解除し、独立編集モードにする。"""
    order = (await db.execute(
        select(Order).where(Order.id == order_id, Order.project_id == project_id)
    )).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注文書が見つかりません")

    order.linked_to_quote = False
    await db.commit()
    await db.refresh(order)
    return _to_read(order)


@router.delete("/projects/{project_id}/orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order(
    project_id: uuid.UUID,
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """注文書を削除する（関連する注文請書も cascade 削除）。"""
    order = (await db.execute(
        select(Order).where(Order.id == order_id, Order.project_id == project_id)
    )).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注文書が見つかりません")
    await db.delete(order)
    await db.commit()


def _ack_to_read(a: Acknowledgment) -> AcknowledgmentRead:
    return AcknowledgmentRead(
        id=a.id,
        order_id=a.order_id,
        project_id=a.project_id,
        acknowledgment_number=a.acknowledgment_number,
        issue_date=a.issue_date,
        client_address=a.client_address,
        client_company=a.client_company,
        client_person=a.client_person,
        amount_excl_tax=float(a.amount_excl_tax) if a.amount_excl_tax is not None else None,
        tax_amount=float(a.tax_amount) if a.tax_amount is not None else None,
        total_amount=float(a.total_amount) if a.total_amount is not None else None,
        stamp_tax=float(a.stamp_tax) if a.stamp_tax is not None else None,
        construction_period_start=a.construction_period_start,
        construction_period_end=a.construction_period_end,
        payment_condition=a.payment_condition,
        terms_and_conditions=a.terms_and_conditions,
        status=a.status,
        created_at=a.created_at,
        updated_at=a.updated_at,
    )
