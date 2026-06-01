"""進捗ログ・添付ファイルモデル。"""
import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, Enum as SAEnum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import CanonSyncStatus, PhotoType, ProgressLogType

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class ProgressLog(Base):
    """案件の進捗・写真・マイルストーンログ。"""

    __tablename__ = "progress_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False
    )
    logged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    logged_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    log_type: Mapped[ProgressLogType] = mapped_column(
        SAEnum(ProgressLogType, name="progresslogtype"), nullable=False
    )
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    status_changed_to: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # relationships
    project: Mapped["Project"] = relationship("Project", back_populates="progress_logs")
    logger: Mapped["User"] = relationship("User")
    attachments: Mapped[list["ProgressAttachment"]] = relationship(
        "ProgressAttachment", back_populates="progress_log"
    )


class ProgressAttachment(Base):
    """進捗ログの添付ファイル。"""

    __tablename__ = "progress_attachments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    progress_log_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("progress_logs.id"), nullable=False
    )
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    canon_sync_status: Mapped[CanonSyncStatus] = mapped_column(
        SAEnum(CanonSyncStatus, name="canonsyncstatus"),
        nullable=False,
        default=CanonSyncStatus.local_only,
    )
    canon_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # 写真台帳・施工前後対比用
    photo_type: Mapped[PhotoType | None] = mapped_column(
        SAEnum(PhotoType, name="phototype"), nullable=True
    )
    work_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tags: Mapped[list | None] = mapped_column(ARRAY(String(100)), nullable=True)
    gps_latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    gps_longitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    location_in_site: Mapped[str | None] = mapped_column(String(100), nullable=True)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    taken_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # relationships
    progress_log: Mapped["ProgressLog"] = relationship("ProgressLog", back_populates="attachments")
