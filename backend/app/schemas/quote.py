"""見積書関連の Pydantic スキーマ。"""
from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.enums import QuoteStatus

TAX_RATE = 0.10

# ---------------------------------------------------------------------------
# QuoteVersion スキーマ
# ---------------------------------------------------------------------------

class QuoteVersionCreate(BaseModel):
    """業者見積版 新規作成。"""
    vendor_id: uuid.UUID | None = None
    vendor_name_snapshot: str | None = None
    markup_rate: float = Field(default=1.0, ge=1.0, le=9.9999)
    notes: str | None = None


class QuoteVersionUpdate(BaseModel):
    """業者見積版 更新。"""
    vendor_id: uuid.UUID | None = None
    vendor_name_snapshot: str | None = None
    markup_rate: float | None = Field(default=None, ge=1.0, le=9.9999)
    is_active: bool | None = None
    notes: str | None = None


class QuoteVersionRead(BaseModel):
    """業者見積版 レスポンス。"""
    id: uuid.UUID
    version_no: int
    vendor_id: uuid.UUID | None
    vendor_name_snapshot: str | None
    markup_rate: float
    is_active: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# QuoteSection スキーマ
# ---------------------------------------------------------------------------

class QuoteSectionCreate(BaseModel):
    """大項目 新規作成。"""
    section_letter: str = Field(..., max_length=3)
    section_name: str = Field(..., max_length=200)
    row_no: int = Field(..., ge=1)


class QuoteSectionUpdate(BaseModel):
    """大項目 更新。"""
    section_letter: str | None = Field(default=None, max_length=3)
    section_name: str | None = Field(default=None, max_length=200)
    row_no: int | None = None


class QuoteSectionRead(BaseModel):
    """大項目 レスポンス（合計金額付き）。"""
    id: uuid.UUID
    section_letter: str
    section_name: str
    row_no: int
    amount: float | None


# ---------------------------------------------------------------------------
# QuoteItem スキーマ
# ---------------------------------------------------------------------------

class QuoteItemInput(BaseModel):
    """見積内訳1行の入力。unit_price が未指定の場合は cost_price × markup で自動計算。"""
    row_no: int = Field(..., ge=1)
    item_name: str | None = None
    spec: str | None = None
    unit: str | None = None
    quantity: float | None = None
    cost_price: float | None = None
    item_markup_rate: float | None = Field(default=None, ge=1.0)
    unit_price: float | None = None
    remarks: str | None = None
    version_id: uuid.UUID | None = None
    section_id: uuid.UUID | None = None


class QuoteItemRead(BaseModel):
    """見積内訳1行のレスポンス。"""
    id: uuid.UUID
    row_no: int
    item_name: str | None
    spec: str | None
    unit: str | None
    quantity: float | None
    cost_price: float | None
    item_markup_rate: float | None
    unit_price: float | None
    amount: float | None
    remarks: str | None
    version_id: uuid.UUID | None
    section_id: uuid.UUID | None


# ---------------------------------------------------------------------------
# Quote スキーマ
# ---------------------------------------------------------------------------

class QuoteCreate(BaseModel):
    """見積書新規作成リクエスト。"""
    quote_number: str | None = None
    issue_date: date | None = None
    validity_days: int = 30
    project_name_snapshot: str | None = None
    project_location_snapshot: str | None = None
    period_start: date | None = None
    period_end: date | None = None
    payment_condition: str | None = None
    remarks: str | None = None
    conditions_text: str | None = None
    discount_amount: float | None = None
    approver_id: uuid.UUID | None = None
    reviewer_id: uuid.UUID | None = None
    person_in_charge_id: uuid.UUID | None = None
    items: list[QuoteItemInput] = Field(default_factory=list)


class QuoteUpdate(BaseModel):
    """見積書更新リクエスト（全フィールドオプション）。"""
    quote_number: str | None = None
    issue_date: date | None = None
    validity_days: int | None = None
    project_name_snapshot: str | None = None
    project_location_snapshot: str | None = None
    period_start: date | None = None
    period_end: date | None = None
    payment_condition: str | None = None
    remarks: str | None = None
    conditions_text: str | None = None
    discount_amount: float | None = None
    approver_id: uuid.UUID | None = None
    reviewer_id: uuid.UUID | None = None
    person_in_charge_id: uuid.UUID | None = None
    items: list[QuoteItemInput] | None = None


class QuoteApproveStamp(BaseModel):
    """稟議承認スタンプ操作。"""
    stamp_type: str = Field(..., pattern="^(person_in_charge|reviewer|approver)$")
    user_id: uuid.UUID
    stamp: bool = True  # True=押印, False=取消


class QuoteListItem(BaseModel):
    """見積書一覧の1行。"""
    id: uuid.UUID
    quote_number: str | None
    issue_date: date | None
    status: QuoteStatus
    subtotal: float | None
    tax_amount: float | None
    total_amount: float | None
    created_at: datetime


class QuoteDetail(BaseModel):
    """見積書詳細レスポンス（版・大項目・内訳行含む）。"""
    id: uuid.UUID
    project_id: uuid.UUID
    quote_number: str | None
    issue_date: date | None
    validity_days: int
    project_name_snapshot: str | None
    project_location_snapshot: str | None
    period_start: date | None
    period_end: date | None
    payment_condition: str | None
    remarks: str | None
    conditions_text: str | None
    subtotal: float | None
    tax_amount: float | None
    total_amount: float | None
    discount_amount: float | None
    approver_id: uuid.UUID | None
    approved_at: datetime | None
    reviewer_id: uuid.UUID | None
    reviewed_at: datetime | None
    person_in_charge_id: uuid.UUID | None
    person_in_charge_confirmed_at: datetime | None
    status: QuoteStatus
    created_at: datetime
    updated_at: datetime
    versions: list[QuoteVersionRead]
    sections: list[QuoteSectionRead]
    items: list[QuoteItemRead]
