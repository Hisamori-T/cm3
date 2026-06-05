"""監査ログ・バックアップ・システム状態 API。"""
from __future__ import annotations

import io
import subprocess
import uuid
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.history import EditHistory
from app.models.user import User

router = APIRouter(tags=["admin-audit"])
logger = structlog.get_logger(__name__)


def _require_admin(user: User) -> None:
    from app.shared.services.permissions import is_admin
    if not is_admin(user):
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="管理者権限が必要です")


# ─── 監査ログ ─────────────────────────────────────────────────────────────────

class AuditLogRead(BaseModel):
    id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID | None
    change_type: str
    changed_by_name: str | None
    changed_at: datetime
    field_changes: dict | None

    model_config = {"from_attributes": True}


@router.get("/admin/audit-log")
async def list_audit_log(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    entity_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """全変更履歴を返す（管理者専用）。"""
    _require_admin(current_user)
    q = select(EditHistory).order_by(EditHistory.changed_at.desc())
    if entity_type:
        q = q.where(EditHistory.entity_type == entity_type)
    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar() or 0
    items = (await db.execute(q.offset((page - 1) * per_page).limit(per_page))).scalars().all()
    return {
        "items": [
            {
                "id": str(item.id),
                "entity_type": item.entity_type,
                "entity_id": str(item.entity_id) if item.entity_id else None,
                "change_type": item.change_type,
                "changed_by_name": item.changed_by_name if hasattr(item, "changed_by_name") else None,
                "changed_at": item.changed_at.isoformat(),
                "field_changes": item.field_changes,
            }
            for item in items
        ],
        "total": total,
    }


@router.get("/admin/audit-log/export-csv")
async def export_audit_csv(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """監査ログを UTF-8 BOM 付き CSV でエクスポート。"""
    _require_admin(current_user)
    items = (await db.execute(
        select(EditHistory).order_by(EditHistory.changed_at.desc())
    )).scalars().all()

    buf = io.StringIO()
    buf.write("﻿")  # BOM
    buf.write("ID,エンティティ種別,エンティティID,変更種別,変更者,変更日時\n")
    for item in items:
        changed_by = getattr(item, "changed_by_name", "") or ""
        buf.write(f'{item.id},{item.entity_type},{item.entity_id or ""},{item.change_type},{changed_by},{item.changed_at.isoformat()}\n')

    content = buf.getvalue().encode("utf-8")
    return StreamingResponse(
        io.BytesIO(content),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=audit_log.csv"},
    )


# ─── システム状態 ─────────────────────────────────────────────────────────────

@router.get("/admin/system-status")
async def get_system_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """API・DB バージョンと稼働確認を返す。"""
    _require_admin(current_user)

    # DB 接続確認
    db_ok = False
    db_version = ""
    try:
        result = await db.execute(text("SELECT version()"))
        db_version = result.scalar() or ""
        db_ok = True
    except Exception:
        pass

    # テーブル数
    table_count = 0
    try:
        result = await db.execute(text("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"))
        table_count = result.scalar() or 0
    except Exception:
        pass

    return {
        "api_version": "3.0.0",
        "db_connected": db_ok,
        "db_version": db_version,
        "table_count": table_count,
        "checked_at": datetime.now(tz=timezone.utc).isoformat(),
    }
