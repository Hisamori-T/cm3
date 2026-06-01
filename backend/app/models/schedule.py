"""スケジュール管理モデル（イベント・参加者）。"""
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import AttendeeResponse, ScheduleEventType, ScheduleVisibility

if TYPE_CHECKING:
    from app.models.gantt import ProjectTask
    from app.models.project import Project
    from app.models.user import User


class ScheduleEvent(Base, TimestampMixin):
    """スケジュールイベント（打合せ・現場訪問・マイルストーン等）。"""

    __tablename__ = "schedule_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True
    )
    project_task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("project_tasks.id"), nullable=True
    )
    event_type: Mapped[ScheduleEventType] = mapped_column(
        SAEnum(ScheduleEventType, name="scheduleeventtype"),
        nullable=False,
        default=ScheduleEventType.meeting,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    all_day: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    organizer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    visibility: Mapped[ScheduleVisibility] = mapped_column(
        SAEnum(ScheduleVisibility, name="schedulevisibility"),
        nullable=False,
        default=ScheduleVisibility.public,
    )
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # relationships
    project: Mapped["Project | None"] = relationship("Project")
    project_task: Mapped["ProjectTask | None"] = relationship("ProjectTask")
    organizer: Mapped["User"] = relationship("User", foreign_keys=[organizer_id])
    attendees: Mapped[list["ScheduleEventAttendee"]] = relationship(
        "ScheduleEventAttendee", back_populates="event", cascade="all, delete-orphan"
    )


class ScheduleEventAttendee(Base):
    """スケジュールイベントの参加者。"""

    __tablename__ = "schedule_event_attendees"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    schedule_event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schedule_events.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    response: Mapped[AttendeeResponse] = mapped_column(
        SAEnum(AttendeeResponse, name="attendeeresponse"),
        nullable=False,
        default=AttendeeResponse.pending,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # relationships
    event: Mapped["ScheduleEvent"] = relationship("ScheduleEvent", back_populates="attendees")
    user: Mapped["User"] = relationship("User")
