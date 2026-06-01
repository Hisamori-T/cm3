"""編集履歴モデル。全エンティティの変更を自動記録。"""
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import EditHistoryChangeType

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class EditHistory(Base):
    """全エンティティの変更履歴。変更前後の値を JSONB で保存。"""

    __tablename__ = "edit_histories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True
    )
    changed_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    change_type: Mapped[EditHistoryChangeType] = mapped_column(
        SAEnum(EditHistoryChangeType, name="edithistorychangetype"), nullable=False
    )
    field_changes: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # relationships
    project: Mapped["Project | None"] = relationship("Project", back_populates="edit_histories")
    changer: Mapped["User"] = relationship("User")
