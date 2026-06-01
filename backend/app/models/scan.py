"""業者見積スキャンジョブ・解析結果モデル。"""
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, Enum as SAEnum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import ScanJobFileType, ScanJobStatus

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User
    from app.models.vendor import Vendor


class ScanJob(Base, TimestampMixin):
    """Gemini Vision による業者見積スキャンジョブ。"""

    __tablename__ = "scan_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    original_file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    original_file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[ScanJobFileType] = mapped_column(
        SAEnum(ScanJobFileType, name="scanjobfiletype"), nullable=False
    )
    status: Mapped[ScanJobStatus] = mapped_column(
        SAEnum(ScanJobStatus, name="scanjobstatus"),
        nullable=False,
        default=ScanJobStatus.pending,
    )
    gemini_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    gemini_response_raw: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 論理削除
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # relationships
    project: Mapped["Project | None"] = relationship("Project", back_populates="scan_jobs")
    uploader: Mapped["User"] = relationship("User", foreign_keys=[uploaded_by])
    deleter: Mapped["User | None"] = relationship("User", foreign_keys=[deleted_by])
    results: Mapped[list["ScanResult"]] = relationship("ScanResult", back_populates="scan_job")


class ScanResult(Base):
    """スキャン解析結果ヘッダ。ユーザーレビュー後に確定。"""

    __tablename__ = "scan_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scan_job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scan_jobs.id"), nullable=False
    )
    vendor_name_detected: Mapped[str | None] = mapped_column(String(200), nullable=True)
    vendor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=True
    )
    quoted_date_detected: Mapped[date | None] = mapped_column(Date, nullable=True)
    subtotal_detected: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    tax_detected: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    total_detected: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Numeric(3, 2), nullable=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # 論理削除
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # relationships
    scan_job: Mapped["ScanJob"] = relationship("ScanJob", back_populates="results")
    vendor: Mapped["Vendor | None"] = relationship("Vendor")
    reviewer: Mapped["User | None"] = relationship("User", foreign_keys=[reviewed_by])
    deleter: Mapped["User | None"] = relationship("User", foreign_keys=[deleted_by])
    items: Mapped[list["ScanResultItem"]] = relationship(
        "ScanResultItem", back_populates="scan_result", order_by="ScanResultItem.row_no"
    )


class ScanResultItem(Base):
    """スキャン解析結果の明細行。"""

    __tablename__ = "scan_result_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scan_result_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scan_results.id"), nullable=False
    )
    row_no: Mapped[int] = mapped_column(Integer, nullable=False)
    item_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    spec: Mapped[str | None] = mapped_column(Text, nullable=True)
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    quantity: Mapped[float | None] = mapped_column(Numeric(12, 3), nullable=True)
    unit_price: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    amount: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Numeric(3, 2), nullable=True)
    applied_to_qcds: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    applied_to_quote: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # relationships
    scan_result: Mapped["ScanResult"] = relationship("ScanResult", back_populates="items")
