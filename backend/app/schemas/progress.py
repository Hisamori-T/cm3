"""進捗ログ関連の Pydantic スキーマ。"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.models.enums import ProgressLogType


class ProgressAttachmentRead(BaseModel):
    id: uuid.UUID
    file_name: str
    mime_type: str | None
    file_size: int | None
    photo_type: str | None = None
    work_type: str | None = None
    location_in_site: str | None = None
    caption: str | None = None
    tags: list[str] | None = None
    taken_at: Any | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ProgressLogCreate(BaseModel):
    log_type: ProgressLogType = ProgressLogType.text
    title: str | None = None
    body: str | None = None


class ProgressLogRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    logged_at: datetime
    logged_by_name: str
    log_type: ProgressLogType
    title: str | None
    body: str | None
    status_changed_to: str | None
    attachments: list[ProgressAttachmentRead]

    model_config = {"from_attributes": True}


class ProgressLogListResponse(BaseModel):
    items: list[ProgressLogRead]
    total: int
