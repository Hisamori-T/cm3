"""注文請書モデル。"""
import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, Enum as SAEnum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import AcknowledgmentStatus

if TYPE_CHECKING:
    from app.models.order import Order
    from app.models.project import Project


class Acknowledgment(Base, TimestampMixin):
    """注文請書（注文書に対して1件発行される）。"""

    __tablename__ = "acknowledgments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False
    )
    acknowledgment_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    issue_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    client_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    client_company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    client_person: Mapped[str | None] = mapped_column(String(100), nullable=True)
    amount_excl_tax: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    tax_amount: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    total_amount: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    stamp_tax: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    construction_period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    construction_period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    payment_condition: Mapped[str | None] = mapped_column(Text, nullable=True)
    terms_and_conditions: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[AcknowledgmentStatus] = mapped_column(
        SAEnum(AcknowledgmentStatus, name="acknowledgmentstatus"),
        nullable=False,
        default=AcknowledgmentStatus.draft,
    )

    # relationships
    order: Mapped["Order"] = relationship("Order", back_populates="acknowledgments")
    project: Mapped["Project"] = relationship("Project")
