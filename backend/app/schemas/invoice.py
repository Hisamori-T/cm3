"""請求書スキーマ。"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.enums import BillingMethod, InvoiceStatus


class InvoiceItemCreate(BaseModel):
    row_no: int
    item_name: str | None = None
    amount: float | None = None
    remarks: str | None = None
    description: str | None = None


class InvoiceCreate(BaseModel):
    issue_date: date | None = None
    previous_balance: float | None = None
    received_amount: float | None = None
    current_purchase: float | None = None
    billing_method: BillingMethod | None = None
    billing_percentage: Decimal | None = None
    billing_note: str | None = None
    payment_due_date: date | None = None
    items: list[InvoiceItemCreate] = []


class InvoiceUpdate(BaseModel):
    issue_date: date | None = None
    previous_balance: float | None = None
    received_amount: float | None = None
    current_purchase: float | None = None
    billing_method: BillingMethod | None = None
    billing_percentage: Decimal | None = None
    billing_note: str | None = None
    payment_due_date: date | None = None
    items: list[InvoiceItemCreate] | None = None
    status: InvoiceStatus | None = None
    work_description: str | None = None
    work_remarks: str | None = None


class InvoiceItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    row_no: int
    item_name: str | None
    amount: float | None
    remarks: str | None
    description: str | None


# ---------------------------------------------------------------------------
# Payment スキーマ
# ---------------------------------------------------------------------------

class PaymentCreate(BaseModel):
    amount: float
    payment_date: date
    payment_method: str | None = None
    note: str | None = None
    target_split_id: uuid.UUID | None = None


class PaymentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    invoice_id: uuid.UUID
    amount: float
    payment_date: date
    payment_method: str | None
    note: str | None
    target_split_id: uuid.UUID | None = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Invoice Read
# ---------------------------------------------------------------------------

class InvoiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    invoice_number: str | None
    issue_date: date | None
    previous_balance: float | None
    received_amount: float | None
    outstanding_balance: float | None
    current_purchase: float | None
    tax_amount: float | None
    total_amount: float | None
    quote_id: uuid.UUID | None
    linked_to_quote: bool
    status: InvoiceStatus
    billing_method: BillingMethod | None
    billing_percentage: float | None
    billing_note: str | None
    payment_due_date: date | None
    split_sequence: int | None
    split_total: int | None
    invoice_type: str
    parent_invoice_id: uuid.UUID | None
    work_description: str | None = None
    work_remarks: str | None = None
    items: list[InvoiceItemRead]
    payments: list[PaymentRead]
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# 案件請求サマリ
# ---------------------------------------------------------------------------

class InvoiceSummary(BaseModel):
    """案件単位の請求・入金サマリ（project_invoice_summary ビューの反映）。"""
    project_id: uuid.UUID
    invoice_count: int
    total_billed: float
    total_paid: float
    outstanding: float
    latest_due_date: date | None
