"""注文書・注文請書モデル。"""
import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, Enum as SAEnum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import OrderStatus

if TYPE_CHECKING:
    from app.models.acknowledgment import Acknowledgment
    from app.models.project import Project


class Order(Base, TimestampMixin):
    """注文書・注文請書。"""

    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False
    )
    order_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    issue_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    client_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    client_company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    client_person: Mapped[str | None] = mapped_column(String(100), nullable=True)
    amount_excl_tax: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    tax_amount: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    total_amount: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    construction_period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    construction_period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    payment_condition: Mapped[str | None] = mapped_column(Text, nullable=True)
    work_content: Mapped[str | None] = mapped_column(Text, nullable=True, default="添付工事内訳書の通り")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    terms_and_conditions: Mapped[str | None] = mapped_column(Text, nullable=True)
    stamp_tax: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    quote_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quotes.id", ondelete="SET NULL"), nullable=True
    )
    linked_to_quote: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[OrderStatus] = mapped_column(
        SAEnum(OrderStatus, name="orderstatus"), nullable=False, default=OrderStatus.draft
    )

    # relationships
    project: Mapped["Project"] = relationship("Project", back_populates="orders")
    acknowledgments: Mapped[list["Acknowledgment"]] = relationship(
        "Acknowledgment", back_populates="order", cascade="all, delete-orphan"
    )
