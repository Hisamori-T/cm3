"""ユーザーモデル。"""
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum as SAEnum, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import UserRole

if TYPE_CHECKING:
    from app.models.project import Project


class User(Base, TimestampMixin):
    """社員ユーザー。ログイン・権限・工事番号採番に使用。"""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    employee_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="userrole"), nullable=False, default=UserRole.staff
    )
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # relationships
    sales_projects: Mapped[list["Project"]] = relationship(
        "Project", foreign_keys="Project.sales_person_id", back_populates="sales_person"
    )
    construction_projects: Mapped[list["Project"]] = relationship(
        "Project",
        foreign_keys="Project.construction_person_id",
        back_populates="construction_person",
    )
    created_projects: Mapped[list["Project"]] = relationship(
        "Project", foreign_keys="Project.created_by", back_populates="creator"
    )
