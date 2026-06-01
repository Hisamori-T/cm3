"""大項目テンプレート関連の Pydantic スキーマ。"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class SectionTemplateItemCreate(BaseModel):
    """テンプレート内大項目 新規作成。"""

    section_code: str = Field(..., max_length=3)
    section_name: str = Field(..., max_length=200)
    display_order: int = Field(..., ge=1)
    default_items: list[dict[str, Any]] | None = None


class SectionTemplateItemRead(BaseModel):
    """テンプレート内大項目 レスポンス。"""

    id: uuid.UUID
    section_code: str
    section_name: str
    display_order: int
    default_items: list[dict[str, Any]] | None


class SectionTemplateCreate(BaseModel):
    """テンプレート 新規作成。"""

    template_name: str = Field(..., max_length=200)
    description: str | None = None
    items: list[SectionTemplateItemCreate] = Field(default_factory=list)


class SectionTemplateUpdate(BaseModel):
    """テンプレート 更新（全フィールドオプション）。"""

    template_name: str | None = Field(default=None, max_length=200)
    description: str | None = None
    is_active: bool | None = None
    items: list[SectionTemplateItemCreate] | None = None


class SectionTemplateRead(BaseModel):
    """テンプレート レスポンス（大項目構成含む）。"""

    id: uuid.UUID
    template_name: str
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    items: list[SectionTemplateItemRead]
