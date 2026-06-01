"""案件コメント・@メンションモデル。"""
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class ProjectComment(Base):
    """案件ごとのコメント（掲示板・@メンション対応）。"""

    __tablename__ = "project_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    mentioned_user_ids: Mapped[list | None] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=True)
    parent_comment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("project_comments.id"), nullable=True
    )
    reactions: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # relationships
    project: Mapped["Project"] = relationship("Project", back_populates="comments")
    user: Mapped["User"] = relationship("User")
    parent: Mapped["ProjectComment | None"] = relationship(
        "ProjectComment", foreign_keys=[parent_comment_id], remote_side="ProjectComment.id", back_populates="replies"
    )
    replies: Mapped[list["ProjectComment"]] = relationship(
        "ProjectComment", foreign_keys=[parent_comment_id], back_populates="parent"
    )
    attachments: Mapped[list["ProjectCommentAttachment"]] = relationship(
        "ProjectCommentAttachment", back_populates="comment", cascade="all, delete-orphan"
    )


class ProjectCommentAttachment(Base):
    """コメントの添付ファイル。"""

    __tablename__ = "project_comment_attachments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    comment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("project_comments.id", ondelete="CASCADE"), nullable=False
    )
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # relationships
    comment: Mapped["ProjectComment"] = relationship("ProjectComment", back_populates="attachments")
