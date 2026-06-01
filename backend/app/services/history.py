"""編集履歴記録サービス。エンドポイントから呼び出す共通ヘルパー。"""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import EditHistoryChangeType
from app.models.history import EditHistory


async def record(
    session: AsyncSession,
    *,
    entity_type: str,
    entity_id: uuid.UUID,
    project_id: uuid.UUID | None,
    changed_by: uuid.UUID,
    change_type: EditHistoryChangeType,
    field_changes: dict[str, Any] | None = None,
) -> EditHistory:
    """編集履歴を1件記録して session に add する（commit は呼び出し側が行う）。"""
    entry = EditHistory(
        id=uuid.uuid4(),
        entity_type=entity_type,
        entity_id=entity_id,
        project_id=project_id,
        changed_by=changed_by,
        change_type=change_type,
        field_changes=field_changes,
    )
    session.add(entry)
    return entry
