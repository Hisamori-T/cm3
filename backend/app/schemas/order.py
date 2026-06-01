"""注文書スキーマ。"""
from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.models.enums import OrderStatus


class OrderCreate(BaseModel):
    issue_date: date | None = None
    client_address: str | None = None
    client_company: str | None = None
    client_person: str | None = None
    amount_excl_tax: float | None = None
    tax_amount: float | None = None
    total_amount: float | None = None
    construction_period_start: date | None = None
    construction_period_end: date | None = None
    payment_condition: str | None = None
    terms_and_conditions: str | None = None


class OrderUpdate(OrderCreate):
    status: OrderStatus | None = None


class OrderRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    order_number: str | None
    issue_date: date | None
    client_address: str | None
    client_company: str | None
    client_person: str | None
    amount_excl_tax: float | None
    tax_amount: float | None
    total_amount: float | None
    construction_period_start: date | None
    construction_period_end: date | None
    payment_condition: str | None
    terms_and_conditions: str | None
    stamp_tax: float | None
    quote_id: uuid.UUID | None
    linked_to_quote: bool
    status: OrderStatus
    created_at: datetime
    updated_at: datetime
