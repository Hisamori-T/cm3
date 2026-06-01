"""業者出面（でづら）管理モデル。"""
import uuid
from datetime import datetime, time
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    Time,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.daily_report import DailyReportEntry
    from app.models.project import Project
    from app.models.user import User
    from app.models.vendor import Vendor


class VendorAttendance(Base):
    """業者出面記録。日報または手動入力で登録。"""

    __tablename__ = "vendor_attendances"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False
    )
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False
    )
    attendance_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    worker_count: Mapped[Decimal] = mapped_column(Numeric(4, 1), nullable=False, default=Decimal("1"))
    worker_names: Mapped[list | None] = mapped_column(ARRAY(String(100)), nullable=True)
    work_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 0), nullable=True)
    amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 0), nullable=True)
    recorded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    daily_report_entry_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("daily_report_entries.id"), nullable=True
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # relationships
    project: Mapped["Project"] = relationship("Project")
    vendor: Mapped["Vendor"] = relationship("Vendor")
    recorder: Mapped["User"] = relationship("User")
    daily_report_entry: Mapped["DailyReportEntry | None"] = relationship("DailyReportEntry")
