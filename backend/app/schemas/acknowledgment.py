"""注文請書スキーマ。"""
from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.models.enums import AcknowledgmentStatus


class AcknowledgmentCreate(BaseModel):
    """注文請書作成スキーマ。注文書からのコピーで生成されるため全フィールドOptional。"""

    issue_date: date | None = None
    client_address: str | None = None
    client_company: str | None = None
    client_person: str | None = None
    amount_excl_tax: float | None = None
    tax_amount: float | None = None
    total_amount: float | None = None
    stamp_tax: float | None = None
    construction_period_start: date | None = None
    construction_period_end: date | None = None
    payment_condition: str | None = None
    terms_and_conditions: str | None = None


class AcknowledgmentUpdate(AcknowledgmentCreate):
    """注文請書更新スキーマ。ステータス変更も可能。"""

    status: AcknowledgmentStatus | None = None


class AcknowledgmentRead(BaseModel):
    """注文請書レスポンス。"""

    id: uuid.UUID
    order_id: uuid.UUID
    project_id: uuid.UUID
    acknowledgment_number: str | None
    issue_date: date | None
    client_address: str | None
    client_company: str | None
    client_person: str | None
    amount_excl_tax: float | None
    tax_amount: float | None
    total_amount: float | None
    stamp_tax: float | None
    construction_period_start: date | None
    construction_period_end: date | None
    payment_condition: str | None
    terms_and_conditions: str | None
    status: AcknowledgmentStatus
    created_at: datetime
    updated_at: datetime
