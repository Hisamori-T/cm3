"""作業日報モデル（日報・作業項目・写真添付）。"""
import uuid
from datetime import datetime, time
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import PhotoType, WeatherType

if TYPE_CHECKING:
    from app.models.gantt import ProjectTask
    from app.models.project import Project
    from app.models.user import User


class DailyReport(Base, TimestampMixin):
    """1日・1人の作業日報。"""

    __tablename__ = "daily_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    report_date: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    weather: Mapped[WeatherType | None] = mapped_column(
        SAEnum(WeatherType, name="weathertype"), nullable=True
    )
    temperature: Mapped[int | None] = mapped_column(Integer, nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # relationships
    user: Mapped["User"] = relationship("User")
    entries: Mapped[list["DailyReportEntry"]] = relationship(
        "DailyReportEntry", back_populates="daily_report", cascade="all, delete-orphan"
    )


class DailyReportEntry(Base):
    """日報内の作業項目（1日報に複数案件分）。"""

    __tablename__ = "daily_report_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    daily_report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("daily_reports.id", ondelete="CASCADE"), nullable=False
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False
    )
    project_task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("project_tasks.id"), nullable=True
    )
    work_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    break_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    working_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    progress_pct: Mapped[int | None] = mapped_column(Integer, nullable=True)
    issues: Mapped[str | None] = mapped_column(Text, nullable=True)
    tomorrow_plan: Mapped[str | None] = mapped_column(Text, nullable=True)

    # relationships
    daily_report: Mapped["DailyReport"] = relationship("DailyReport", back_populates="entries")
    project: Mapped["Project"] = relationship("Project")
    project_task: Mapped["ProjectTask | None"] = relationship("ProjectTask")
    attachments: Mapped[list["DailyReportAttachment"]] = relationship(
        "DailyReportAttachment", back_populates="entry", cascade="all, delete-orphan"
    )


class DailyReportAttachment(Base):
    """日報の写真添付。"""

    __tablename__ = "daily_report_attachments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    daily_report_entry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("daily_report_entries.id", ondelete="CASCADE"), nullable=False
    )
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    photo_type: Mapped[PhotoType | None] = mapped_column(
        SAEnum(PhotoType, name="phototype"), nullable=True
    )
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    gps_latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    gps_longitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    taken_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # relationships
    entry: Mapped["DailyReportEntry"] = relationship("DailyReportEntry", back_populates="attachments")
