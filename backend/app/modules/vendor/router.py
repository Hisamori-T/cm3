"""業者マスタエンドポイント。"""
from __future__ import annotations

import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.enums import UserRole
from app.models.user import User
from app.models.vendor import Vendor, VendorPriceHistory
from app.schemas.vendor import (
    PriceHistoryListResponse,
    PriceHistoryRead,
    VendorCreate,
    VendorDetail,
    VendorListItem,
    VendorListResponse,
    VendorUpdate,
)

router = APIRouter(tags=["vendors"])
logger = structlog.get_logger(__name__)


def _to_list_item(v: Vendor) -> VendorListItem:
    return VendorListItem(
        id=v.id,
        vendor_name=v.vendor_name,
        vendor_name_kana=v.vendor_name_kana,
        primary_work_types=v.primary_work_types,
        phone=v.phone,
        contact_person=v.contact_person,
        is_active=v.is_active,
        created_at=v.created_at,
    )


def _to_detail(v: Vendor) -> VendorDetail:
    return VendorDetail(
        id=v.id,
        vendor_name=v.vendor_name,
        vendor_name_kana=v.vendor_name_kana,
        primary_work_types=v.primary_work_types,
        postal_code=v.postal_code,
        address=v.address,
        phone=v.phone,
        email=v.email,
        contact_person=v.contact_person,
        bank_info=v.bank_info,
        note=v.note,
        is_active=v.is_active,
        created_at=v.created_at,
        updated_at=v.updated_at,
    )


@router.get("/vendors", response_model=VendorListResponse)
async def list_vendors(
    q: str | None = Query(None, description="業者名・カナ・担当者名で検索"),
    active_only: bool = Query(True, description="有効業者のみ表示"),
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VendorListResponse:
    """業者一覧を返す。"""
    stmt = select(Vendor)
    if active_only:
        stmt = stmt.where(Vendor.is_active.is_(True))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                Vendor.vendor_name.ilike(like),
                Vendor.vendor_name_kana.ilike(like),
                Vendor.contact_person.ilike(like),
            )
        )
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (
        await db.execute(
            stmt.order_by(Vendor.vendor_name).offset((page - 1) * per_page).limit(per_page)
        )
    ).scalars().all()

    return VendorListResponse(
        items=[_to_list_item(v) for v in rows],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("/vendors", response_model=VendorDetail, status_code=status.HTTP_201_CREATED)
async def create_vendor(
    body: VendorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VendorDetail:
    """業者を新規作成する。管理者のみ。"""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="管理者のみ操作できます")

    vendor = Vendor(
        id=uuid.uuid4(),
        vendor_name=body.vendor_name,
        vendor_name_kana=body.vendor_name_kana,
        primary_work_types=body.primary_work_types,
        postal_code=body.postal_code,
        address=body.address,
        phone=body.phone,
        email=body.email,
        contact_person=body.contact_person,
        bank_info=body.bank_info,
        note=body.note,
    )
    db.add(vendor)
    await db.commit()
    await db.refresh(vendor)

    logger.info("vendor_created", vendor_id=str(vendor.id), user_id=str(current_user.id))
    return _to_detail(vendor)


@router.post("/vendors/bulk-deactivate", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_deactivate_vendors(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """業者を一括無効化（論理削除）する。管理者のみ。"""
    if current_user.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="管理者のみ操作できます")
    vendor_ids: list[str] = body.get("vendor_ids", [])
    if not vendor_ids:
        return
    ids = [uuid.UUID(v) for v in vendor_ids]
    vendors = (await db.execute(
        select(Vendor).where(Vendor.id.in_(ids))
    )).scalars().all()
    for v in vendors:
        v.is_active = False
    await db.commit()
    logger.info("vendors_bulk_deactivated", count=len(vendors), user_id=str(current_user.id))


@router.get("/vendors/{vendor_id}", response_model=VendorDetail)
async def get_vendor(
    vendor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VendorDetail:
    """業者詳細を返す。"""
    vendor = (await db.execute(
        select(Vendor).where(Vendor.id == vendor_id)
    )).scalar_one_or_none()
    if vendor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="業者が見つかりません")
    return _to_detail(vendor)


@router.patch("/vendors/{vendor_id}", response_model=VendorDetail)
async def update_vendor(
    vendor_id: uuid.UUID,
    body: VendorUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VendorDetail:
    """業者情報を更新する。管理者のみ。"""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="管理者のみ操作できます")

    vendor = (await db.execute(
        select(Vendor).where(Vendor.id == vendor_id)
    )).scalar_one_or_none()
    if vendor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="業者が見つかりません")

    for field_name in [
        "vendor_name", "vendor_name_kana", "primary_work_types",
        "postal_code", "address", "phone", "email",
        "contact_person", "bank_info", "note", "is_active",
    ]:
        value = getattr(body, field_name)
        if value is not None:
            setattr(vendor, field_name, value)

    await db.commit()
    await db.refresh(vendor)

    logger.info("vendor_updated", vendor_id=str(vendor_id), user_id=str(current_user.id))
    return _to_detail(vendor)


@router.get("/vendors/price-history/search", response_model=PriceHistoryListResponse)
async def search_price_history(
    q: str | None = Query(None, description="工事項目名で検索"),
    vendor_id: uuid.UUID | None = Query(None, description="業者IDで絞り込み"),
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PriceHistoryListResponse:
    """全業者横断で単価履歴を検索する（見積流用用）。"""
    stmt = (
        select(VendorPriceHistory, Vendor.vendor_name)
        .join(Vendor, Vendor.id == VendorPriceHistory.vendor_id)
    )
    if vendor_id:
        stmt = stmt.where(VendorPriceHistory.vendor_id == vendor_id)
    if q:
        stmt = stmt.where(VendorPriceHistory.item_name.ilike(f"%{q}%"))

    total = (
        await db.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()
    rows = (
        await db.execute(
            stmt.order_by(VendorPriceHistory.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
    ).all()

    items = [
        PriceHistoryRead(
            id=h.id,
            vendor_id=h.vendor_id,
            vendor_name=vname,
            project_id=h.project_id,
            item_name=h.item_name,
            item_spec=h.item_spec,
            unit=h.unit,
            quantity=float(h.quantity) if h.quantity is not None else None,
            unit_price=float(h.unit_price) if h.unit_price is not None else None,
            amount=float(h.amount) if h.amount is not None else None,
            quoted_at=h.quoted_at,
            source=h.source,
            created_at=h.created_at,
        )
        for h, vname in rows
    ]
    return PriceHistoryListResponse(items=items, total=total)


@router.get("/vendors/{vendor_id}/price-history", response_model=PriceHistoryListResponse)
async def get_price_history(
    vendor_id: uuid.UUID,
    q: str | None = Query(None, description="工事項目名で検索"),
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PriceHistoryListResponse:
    """業者の単価履歴一覧を返す。"""
    vendor = (await db.execute(
        select(Vendor).where(Vendor.id == vendor_id)
    )).scalar_one_or_none()
    if vendor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="業者が見つかりません")

    stmt = select(VendorPriceHistory).where(VendorPriceHistory.vendor_id == vendor_id)
    if q:
        stmt = stmt.where(VendorPriceHistory.item_name.ilike(f"%{q}%"))

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (
        await db.execute(
            stmt.order_by(VendorPriceHistory.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
    ).scalars().all()

    items = [
        PriceHistoryRead(
            id=h.id,
            vendor_id=h.vendor_id,
            vendor_name=vendor.vendor_name,
            project_id=h.project_id,
            item_name=h.item_name,
            item_spec=h.item_spec,
            unit=h.unit,
            quantity=float(h.quantity) if h.quantity is not None else None,
            unit_price=float(h.unit_price) if h.unit_price is not None else None,
            amount=float(h.amount) if h.amount is not None else None,
            quoted_at=h.quoted_at,
            source=h.source,
            created_at=h.created_at,
        )
        for h in rows
    ]

    return PriceHistoryListResponse(items=items, total=total)
