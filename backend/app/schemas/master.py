"""マスタスキーマ（印紙税・見積条件テンプレート）。"""
from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel


class StampTaxRead(BaseModel):
    id: uuid.UUID
    min_amount: float
    max_amount: float | None
    tax_amount: float
    effective_from: date


class StampTaxCreate(BaseModel):
    min_amount: float
    max_amount: float | None = None
    tax_amount: float
    effective_from: date


class StampTaxUpdate(BaseModel):
    min_amount: float | None = None
    max_amount: float | None = None
    tax_amount: float | None = None
    effective_from: date | None = None


class QuoteConditionTemplateRead(BaseModel):
    id: uuid.UUID
    name: str
    content: str
    is_active: bool
    created_at: datetime


class QuoteConditionTemplateCreate(BaseModel):
    name: str
    content: str
    is_active: bool = True


class QuoteConditionTemplateUpdate(BaseModel):
    name: str | None = None
    content: str | None = None
    is_active: bool | None = None
