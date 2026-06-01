"""業者マスタ関連の Pydantic スキーマ。"""
from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import VendorPriceHistorySource


class VendorCreate(BaseModel):
    """業者新規作成リクエスト。"""

    vendor_name: str = Field(..., min_length=1, max_length=200)
    vendor_name_kana: str | None = None
    primary_work_types: list[str] | None = None
    postal_code: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    contact_person: str | None = None
    bank_info: str | None = None
    note: str | None = None


class VendorUpdate(BaseModel):
    """業者更新リクエスト（全フィールドオプション）。"""

    vendor_name: str | None = Field(None, min_length=1, max_length=200)
    vendor_name_kana: str | None = None
    primary_work_types: list[str] | None = None
    postal_code: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    contact_person: str | None = None
    bank_info: str | None = None
    note: str | None = None
    is_active: bool | None = None


class VendorListItem(BaseModel):
    """業者一覧の1行。"""

    id: uuid.UUID
    vendor_name: str
    vendor_name_kana: str | None
    primary_work_types: list[str] | None
    phone: str | None
    contact_person: str | None
    is_active: bool
    created_at: datetime


class VendorDetail(BaseModel):
    """業者詳細レスポンス。"""

    id: uuid.UUID
    vendor_name: str
    vendor_name_kana: str | None
    primary_work_types: list[str] | None
    postal_code: str | None
    address: str | None
    phone: str | None
    email: str | None
    contact_person: str | None
    bank_info: str | None
    note: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class VendorListResponse(BaseModel):
    """業者一覧レスポンス（ページネーション付き）。"""

    items: list[VendorListItem]
    total: int
    page: int
    per_page: int


class PriceHistoryRead(BaseModel):
    """単価履歴1件のレスポンス。"""

    id: uuid.UUID
    vendor_id: uuid.UUID
    vendor_name: str | None
    project_id: uuid.UUID | None
    item_name: str
    item_spec: str | None
    unit: str | None
    quantity: float | None
    unit_price: float | None
    amount: float | None
    quoted_at: date | None
    source: VendorPriceHistorySource
    created_at: datetime


class PriceHistoryListResponse(BaseModel):
    """単価履歴一覧レスポンス。"""

    items: list[PriceHistoryRead]
    total: int
