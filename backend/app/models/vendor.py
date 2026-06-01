"""業者マスタ・業者単価履歴モデル。"""
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, Enum as SAEnum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import VendorPriceHistorySource

if TYPE_CHECKING:
    from app.models.project import Project


class Vendor(Base, TimestampMixin):
    """業者マスタ。"""

    __tablename__ = "vendors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_name: Mapped[str] = mapped_column(String(200), nullable=False)
    vendor_name_kana: Mapped[str | None] = mapped_column(String(200), nullable=True)
    primary_work_types: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_person: Mapped[str | None] = mapped_column(String(100), nullable=True)
    bank_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # relationships
    price_histories: Mapped[list["VendorPriceHistory"]] = relationship(
        "VendorPriceHistory", back_populates="vendor"
    )


class VendorPriceHistory(Base):
    """業者の単価履歴。スキャン・手動入力から蓄積。"""

    __tablename__ = "vendor_price_histories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True
    )
    item_name: Mapped[str] = mapped_column(String(200), nullable=False)
    item_spec: Mapped[str | None] = mapped_column(Text, nullable=True)
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    quantity: Mapped[float | None] = mapped_column(Numeric(12, 3), nullable=True)
    unit_price: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    amount: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    quoted_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    source: Mapped[VendorPriceHistorySource] = mapped_column(
        SAEnum(VendorPriceHistorySource, name="vendorpricehistorysource"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # relationships
    vendor: Mapped["Vendor"] = relationship("Vendor", back_populates="price_histories")
