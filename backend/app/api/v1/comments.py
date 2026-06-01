"""案件コメント・@メンション API。"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.comment import ProjectComment, ProjectCommentAttachment
from app.models.project import Project
from app.models.user import User

logger = structlog.get_logger()
router = APIRouter()


# ── Pydantic スキーマ ─────────────────────────────────────────

class CommentAttachmentRead(BaseModel):
    id: uuid.UUID
    file_path: str
    file_name: str
    mime_type: str | None

    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    body: str
    parent_comment_id: uuid.UUID | None = None
    mentioned_user_ids: list[uuid.UUID] = []


class CommentRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    body: str
    mentioned_user_ids: list[uuid.UUID] | None
    parent_comment_id: uuid.UUID | None
    reactions: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime
    attachments: list[CommentAttachmentRead] = []
    user_name: str | None = None
    replies: list["CommentRead"] = []

    model_config = {"from_attributes": True}


CommentRead.model_rebuild()


# ── ヘルパー ─────────────────────────────────────────────────

async def _get_project_or_404(project_id: uuid.UUID, db: AsyncSession) -> Project:
    p = await db.get(Project, project_id)
    if p is None or p.deleted_at is not None:
        raise HTTPException(status_code=404, detail="案件が見つかりません")
    return p


def _serialize(c: ProjectComment) -> CommentRead:
    return CommentRead(
        **{k: getattr(c, k) for k in CommentRead.model_fields if hasattr(c, k)},
        attachments=[CommentAttachmentRead.model_validate(a) for a in c.attachments],
        user_name=c.user.full_name if c.user else None,
        replies=[_serialize(r) for r in (c.replies or [])],
    )


# ── エンドポイント ────────────────────────────────────────────

@router.get("/projects/{project_id}/comments", response_model=list[CommentRead])
async def list_comments(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[CommentRead]:
    """案件コメント一覧（トップレベルのみ、reply は内包）。"""
    await _get_project_or_404(project_id, db)
    result = await db.execute(
        select(ProjectComment)
        .options(
            selectinload(ProjectComment.user),
            selectinload(ProjectComment.attachments),
            selectinload(ProjectComment.replies).selectinload(ProjectComment.user),
            selectinload(ProjectComment.replies).selectinload(ProjectComment.attachments),
        )
        .where(
            ProjectComment.project_id == project_id,
            ProjectComment.parent_comment_id.is_(None),
        )
        .order_by(ProjectComment.created_at.asc())
    )
    return [_serialize(c) for c in result.scalars().all()]


@router.post("/projects/{project_id}/comments", response_model=CommentRead, status_code=status.HTTP_201_CREATED)
async def create_comment(
    project_id: uuid.UUID,
    body: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommentRead:
    """コメント投稿。"""
    await _get_project_or_404(project_id, db)
    comment = ProjectComment(
        project_id=project_id,
        user_id=current_user.id,
        body=body.body,
        parent_comment_id=body.parent_comment_id,
        mentioned_user_ids=body.mentioned_user_ids or None,
    )
    db.add(comment)
    await db.commit()
    result = await db.execute(
        select(ProjectComment)
        .options(
            selectinload(ProjectComment.user),
            selectinload(ProjectComment.attachments),
            selectinload(ProjectComment.replies),
        )
        .where(ProjectComment.id == comment.id)
    )
    return _serialize(result.scalar_one())


@router.delete("/projects/{project_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    project_id: uuid.UUID,
    comment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """コメント削除（投稿者本人または管理者）。"""
    comment = await db.get(ProjectComment, comment_id)
    if comment is None or comment.project_id != project_id:
        raise HTTPException(status_code=404, detail="コメントが見つかりません")
    if comment.user_id != current_user.id and current_user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="削除権限がありません")
    await db.delete(comment)
    await db.commit()


@router.post("/projects/{project_id}/comments/{comment_id}/react")
async def react_to_comment(
    project_id: uuid.UUID,
    comment_id: uuid.UUID,
    emoji: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """絵文字リアクション追加/トグル。"""
    comment = await db.get(ProjectComment, comment_id)
    if comment is None or comment.project_id != project_id:
        raise HTTPException(status_code=404, detail="コメントが見つかりません")
    reactions: dict[str, list[str]] = dict(comment.reactions or {})
    user_id_str = str(current_user.id)
    if emoji not in reactions:
        reactions[emoji] = []
    if user_id_str in reactions[emoji]:
        reactions[emoji].remove(user_id_str)
    else:
        reactions[emoji].append(user_id_str)
    if not reactions[emoji]:
        del reactions[emoji]
    comment.reactions = reactions
    await db.commit()
    return reactions
