"""顧客マスタエンドポイント。"""
from __future__ import annotations

import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.client import Client, ClientContact, ClientSite
from app.models.project import Project
from app.models.user import User
from app.schemas.client import (
    ClientContactCreate,
    ClientContactRead,
    ClientCreate,
    ClientDetail,
    ClientListItem,
    ClientListResponse,
    ClientSiteCreate,
    ClientSiteDetail,
    ClientSiteRead,
    ClientSiteUpdate,
    ClientUpdate,
)

router = APIRouter(tags=["clients"])
logger = structlog.get_logger(__name__)


async def _project_count(db: AsyncSession, client_id: uuid.UUID) -> int:
    r = await db.execute(
        select(func.count()).select_from(Project).where(
            Project.client_id == client_id, Project.deleted_at.is_(None)
        )
    )
    return r.scalar_one()


def _to_list_item(c: Client, site_count: int, project_count: int) -> ClientListItem:
    return ClientListItem(
        id=c.id,
        client_code=c.client_code,
        client_name=c.client_name,
        client_name_kana=c.client_name_kana,
        client_rank=c.client_rank,
        phone=c.phone,
        is_active=c.is_active,
        site_count=site_count,
        project_count=project_count,
        created_at=c.created_at,
    )


def _to_detail(c: Client, site_count: int, project_count: int) -> ClientDetail:
    return ClientDetail(
        id=c.id,
        client_code=c.client_code,
        client_name=c.client_name,
        client_name_kana=c.client_name_kana,
        postal_code=c.postal_code,
        address=c.address,
        phone=c.phone,
        fax=c.fax,
        email=c.email,
        representative=c.representative,
        client_rank=c.client_rank,
        payment_condition_default=c.payment_condition_default,
        credit_limit=float(c.credit_limit) if c.credit_limit is not None else None,
        tax_id=c.tax_id,
        is_active=c.is_active,
        note=c.note,
        site_count=site_count,
        project_count=project_count,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


# ────────────────────────────────────────────────────────────────
# 顧客 CRUD
# ────────────────────────────────────────────────────────────────

@router.get("/clients/search", response_model=list[ClientListItem])
async def search_clients(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ClientListItem]:
    """顧客名・コード・住所でインクリメンタル検索（案件作成コンポーネント用）。"""
    like = f"%{q}%"
    result = await db.execute(
        select(Client)
        .where(
            Client.is_active.is_(True),
            or_(
                Client.client_name.ilike(like),
                Client.client_name_kana.ilike(like),
                Client.client_code.ilike(like),
            ),
        )
        .limit(limit)
    )
    clients = result.scalars().all()
    items = []
    for c in clients:
        sc = await db.execute(
            select(func.count()).select_from(ClientSite).where(ClientSite.client_id == c.id)
        )
        items.append(_to_list_item(c, sc.scalar_one(), 0))
    return items


@router.get("/clients", response_model=ClientListResponse)
async def list_clients(
    q: str | None = Query(None, description="顧客名・カナ・コードで検索"),
    rank: str | None = Query(None, description="ランクフィルタ (A/B/C)"),
    active_only: bool = Query(True),
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ClientListResponse:
    """顧客一覧。"""
    stmt = select(Client)
    if active_only:
        stmt = stmt.where(Client.is_active.is_(True))
    if rank:
        stmt = stmt.where(Client.client_rank == rank)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                Client.client_name.ilike(like),
                Client.client_name_kana.ilike(like),
                Client.client_code.ilike(like),
            )
        )

    total_r = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = total_r.scalar_one()

    stmt = stmt.order_by(Client.client_name).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(stmt)
    clients = result.scalars().all()

    items = []
    for c in clients:
        sc = await db.execute(
            select(func.count()).select_from(ClientSite).where(ClientSite.client_id == c.id)
        )
        pc = await _project_count(db, c.id)
        items.append(_to_list_item(c, sc.scalar_one(), pc))

    return ClientListResponse(items=items, total=total, page=page, per_page=per_page)


@router.post("/clients", response_model=ClientDetail, status_code=status.HTTP_201_CREATED)
async def create_client(
    body: ClientCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ClientDetail:
    """顧客新規作成。"""
    client = Client(**body.model_dump())
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return _to_detail(client, 0, 0)


@router.get("/clients/{client_id}", response_model=ClientDetail)
async def get_client(
    client_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ClientDetail:
    """顧客詳細。"""
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if client is None:
        raise HTTPException(status_code=404, detail="顧客が見つかりません")
    sc = await db.execute(
        select(func.count()).select_from(ClientSite).where(ClientSite.client_id == client_id)
    )
    pc = await _project_count(db, client_id)
    return _to_detail(client, sc.scalar_one(), pc)


@router.patch("/clients/{client_id}", response_model=ClientDetail)
async def update_client(
    client_id: uuid.UUID,
    body: ClientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientDetail:
    """顧客情報更新。"""
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if client is None:
        raise HTTPException(status_code=404, detail="顧客が見つかりません")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(client, field, val)
    await db.commit()
    await db.refresh(client)
    sc = await db.execute(
        select(func.count()).select_from(ClientSite).where(ClientSite.client_id == client_id)
    )
    pc = await _project_count(db, client_id)
    return _to_detail(client, sc.scalar_one(), pc)


@router.delete("/clients/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """顧客論理削除（is_active=False）。admin only。"""
    from app.models.enums import UserRole
    if current_user.role not in (UserRole.admin, UserRole.super_admin):
        raise HTTPException(status_code=403, detail="管理者のみ操作できます")
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if client is None:
        raise HTTPException(status_code=404, detail="顧客が見つかりません")
    client.is_active = False
    await db.commit()


# ────────────────────────────────────────────────────────────────
# 店舗 (Sites)
# ────────────────────────────────────────────────────────────────

@router.get("/clients/{client_id}/sites", response_model=list[ClientSiteRead])
async def list_sites(
    client_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ClientSiteRead]:
    """顧客の店舗一覧。"""
    result = await db.execute(
        select(ClientSite)
        .where(ClientSite.client_id == client_id)
        .order_by(ClientSite.region, ClientSite.site_name)
    )
    return [ClientSiteRead.model_validate(s) for s in result.scalars().all()]


@router.post(
    "/clients/{client_id}/sites",
    response_model=ClientSiteRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_site(
    client_id: uuid.UUID,
    body: ClientSiteCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ClientSiteRead:
    """店舗新規作成。"""
    site = ClientSite(client_id=client_id, **body.model_dump())
    db.add(site)
    await db.commit()
    await db.refresh(site)
    return ClientSiteRead.model_validate(site)


@router.patch("/clients/{client_id}/sites/{site_id}", response_model=ClientSiteRead)
async def update_site(
    client_id: uuid.UUID,
    site_id: uuid.UUID,
    body: ClientSiteUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ClientSiteRead:
    """店舗情報更新。"""
    result = await db.execute(
        select(ClientSite).where(ClientSite.id == site_id, ClientSite.client_id == client_id)
    )
    site = result.scalar_one_or_none()
    if site is None:
        raise HTTPException(status_code=404, detail="店舗が見つかりません")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(site, field, val)
    await db.commit()
    await db.refresh(site)
    return ClientSiteRead.model_validate(site)


# ────────────────────────────────────────────────────────────────
# 担当者 (Contacts)
# ────────────────────────────────────────────────────────────────

@router.get("/clients/{client_id}/contacts", response_model=list[ClientContactRead])
async def list_contacts(
    client_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ClientContactRead]:
    """顧客の担当者一覧。"""
    result = await db.execute(
        select(ClientContact)
        .where(ClientContact.client_id == client_id)
        .order_by(ClientContact.is_primary.desc(), ClientContact.name)
    )
    return [ClientContactRead.model_validate(c) for c in result.scalars().all()]


@router.post(
    "/clients/{client_id}/contacts",
    response_model=ClientContactRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_contact(
    client_id: uuid.UUID,
    body: ClientContactCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ClientContactRead:
    """担当者新規作成。"""
    contact = ClientContact(client_id=client_id, **body.model_dump())
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return ClientContactRead.model_validate(contact)
