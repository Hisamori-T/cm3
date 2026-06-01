"""ガントチャート工程表モデル（工種マスタ・工程タスク）。"""
import uuid
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Date,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import TaskDependencyType, TaskStatus

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User
    from app.models.vendor import Vendor


class WorkTypeMaster(Base, TimestampMixin):
    """工種マスタ（仮設・解体・土工事・内装等）。"""

    __tablename__ = "work_type_master"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    default_color: Mapped[str] = mapped_column(String(20), nullable=False, default="#3B82F6")
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # relationships
    tasks: Mapped[list["ProjectTask"]] = relationship("ProjectTask", back_populates="work_type_master")


class ProjectTask(Base, TimestampMixin):
    """工程タスク。案件のガントチャートを構成する1行。"""

    __tablename__ = "project_tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False
    )
    parent_task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("project_tasks.id"), nullable=True
    )
    task_no: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    task_name: Mapped[str] = mapped_column(String(255), nullable=False)
    work_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    work_type_master_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("work_type_master.id"), nullable=True
    )
    planned_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    planned_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    actual_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    actual_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    progress_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("0")
    )
    assigned_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    assigned_vendor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=True
    )
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    dependency_task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("project_tasks.id"), nullable=True
    )
    dependency_type: Mapped[TaskDependencyType | None] = mapped_column(
        SAEnum(TaskDependencyType, name="taskdependencytype"), nullable=True
    )
    status: Mapped[TaskStatus] = mapped_column(
        SAEnum(TaskStatus, name="taskstatus"),
        nullable=False,
        default=TaskStatus.planned,
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # relationships
    project: Mapped["Project"] = relationship("Project", back_populates="tasks")
    parent_task: Mapped["ProjectTask | None"] = relationship(
        "ProjectTask", foreign_keys=[parent_task_id], back_populates="child_tasks", remote_side="ProjectTask.id"
    )
    child_tasks: Mapped[list["ProjectTask"]] = relationship(
        "ProjectTask", foreign_keys=[parent_task_id], back_populates="parent_task"
    )
    dependency_task: Mapped["ProjectTask | None"] = relationship(
        "ProjectTask", foreign_keys=[dependency_task_id], remote_side="ProjectTask.id"
    )
    assigned_user: Mapped["User | None"] = relationship("User", foreign_keys=[assigned_user_id])
    assigned_vendor: Mapped["Vendor | None"] = relationship("Vendor")
    work_type_master: Mapped["WorkTypeMaster | None"] = relationship(
        "WorkTypeMaster", back_populates="tasks"
    )
