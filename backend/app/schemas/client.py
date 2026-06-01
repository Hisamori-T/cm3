"""顧客マスタ関連 Pydantic スキーマ。"""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.enums import ClientRank


# ── ClientContact ──────────────────────────────────────────────

class ClientContactCreate(BaseModel):
    """担当者新規作成。"""
    client_site_id: uuid.UUID | None = None
    department: str | None = None
    name: str
    name_kana: str | None = None
    title: str | None = None
    phone: str | None = None
    email: str | None = None
    is_primary: bool = False
    note: str | None = None


class ClientContactRead(BaseModel):
    """担当者読み取り。"""
    id: uuid.UUID
    client_id: uuid.UUID
    client_site_id: uuid.UUID | None
    department: str | None
    name: str
    name_kana: str | None
    title: str | None
    phone: str | None
    email: str | None
    is_primary: bool
    note: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# ── ClientSite ─────────────────────────────────────────────────

class ClientSiteCreate(BaseModel):
    """店舗新規作成。"""
    site_code: str | None = None
    site_name: str
    region: str | None = None
    postal_code: str | None = None
    address: str | None = None
    site_manager: str | None = None
    site_phone: str | None = None
    note: str | None = None


class ClientSiteUpdate(BaseModel):
    """店舗更新。"""
    site_code: str | None = None
    site_name: str | None = None
    region: str | None = None
    postal_code: str | None = None
    address: str | None = None
    site_manager: str | None = None
    site_phone: str | None = None
    note: str | None = None


class ClientSiteRead(BaseModel):
    """店舗読み取り（コンタクト含まず）。"""
    id: uuid.UUID
    client_id: uuid.UUID
    site_code: str | None
    site_name: str
    region: str | None
    postal_code: str | None
    address: str | None
    site_manager: str | None
    site_phone: str | None
    note: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class ClientSiteDetail(ClientSiteRead):
    """店舗詳細（コンタクト含む）。"""
    contacts: list[ClientContactRead] = []


# ── Client ────────────────────────────────────────────────────

class ClientCreate(BaseModel):
    """顧客新規作成。"""
    client_code: str | None = None
    client_name: str
    client_name_kana: str | None = None
    postal_code: str | None = None
    address: str | None = None
    phone: str | None = None
    fax: str | None = None
    email: str | None = None
    representative: str | None = None
    client_rank: ClientRank | None = None
    payment_condition_default: str | None = None
    credit_limit: float | None = None
    tax_id: str | None = None
    is_active: bool = True
    note: str | None = None


class ClientUpdate(BaseModel):
    """顧客更新。"""
    client_code: str | None = None
    client_name: str | None = None
    client_name_kana: str | None = None
    postal_code: str | None = None
    address: str | None = None
    phone: str | None = None
    fax: str | None = None
    email: str | None = None
    representative: str | None = None
    client_rank: ClientRank | None = None
    payment_condition_default: str | None = None
    credit_limit: float | None = None
    tax_id: str | None = None
    is_active: bool | None = None
    note: str | None = None


class ClientListItem(BaseModel):
    """顧客一覧行。"""
    id: uuid.UUID
    client_code: str | None
    client_name: str
    client_name_kana: str | None
    client_rank: ClientRank | None
    phone: str | None
    is_active: bool
    site_count: int = 0
    project_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class ClientListResponse(BaseModel):
    """顧客一覧レスポンス。"""
    items: list[ClientListItem]
    total: int
    page: int
    per_page: int


class ClientDetail(BaseModel):
    """顧客詳細。"""
    id: uuid.UUID
    client_code: str | None
    client_name: str
    client_name_kana: str | None
    postal_code: str | None
    address: str | None
    phone: str | None
    fax: str | None
    email: str | None
    representative: str | None
    client_rank: ClientRank | None
    payment_condition_default: str | None
    credit_limit: float | None
    tax_id: str | None
    is_active: bool
    note: str | None
    site_count: int = 0
    project_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
