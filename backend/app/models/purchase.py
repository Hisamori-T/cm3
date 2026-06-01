"""発注・仕入管理モデル（発注書・明細・納品記録）。"""
import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import DeliveryStatus, PurchaseOrderStatus

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.qcds import QCDSDirectWork
    from app.models.user import User
    from app.models.vendor import Vendor


class PurchaseOrder(Base, TimestampMixin):
    """発注書。QCDSの取決見通表行に紐付く。"""

    __tablename__ = "purchase_orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False
    )
    qcds_direct_work_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("qcds_direct_works.id"), nullable=True
    )
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False
    )
    order_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    order_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    delivery_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    delivery_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 0), nullable=False, default=Decimal("0"))
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(12, 0), nullable=False, default=Decimal("0"))
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 0), nullable=False, default=Decimal("0"))
    status: Mapped[PurchaseOrderStatus] = mapped_column(
        SAEnum(PurchaseOrderStatus, name="purchaseorderstatus"),
        nullable=False,
        default=PurchaseOrderStatus.draft,
    )
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payment_due_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # relationships
    project: Mapped["Project"] = relationship("Project")
    vendor: Mapped["Vendor"] = relationship("Vendor")
    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by])
    items: Mapped[list["PurchaseOrderItem"]] = relationship(
        "PurchaseOrderItem", back_populates="purchase_order", cascade="all, delete-orphan"
    )


class PurchaseOrderItem(Base):
    """発注書明細。"""

    __tablename__ = "purchase_order_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False
    )
    row_no: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    spec: Mapped[str | None] = mapped_column(Text, nullable=True)
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("1"))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 0), nullable=False, default=Decimal("0"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 0), nullable=False, default=Decimal("0"))
    delivered_quantity: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=Decimal("0")
    )
    delivery_status: Mapped[DeliveryStatus] = mapped_column(
        SAEnum(DeliveryStatus, name="deliverystatus"),
        nullable=False,
        default=DeliveryStatus.pending,
    )

    # relationships
    purchase_order: Mapped["PurchaseOrder"] = relationship("PurchaseOrder", back_populates="items")
    deliveries: Mapped[list["VendorDelivery"]] = relationship(
        "VendorDelivery", back_populates="purchase_order_item", cascade="all, delete-orphan"
    )


class VendorDelivery(Base):
    """納品記録。"""

    __tablename__ = "vendor_deliveries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_order_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("purchase_order_items.id", ondelete="CASCADE"), nullable=False
    )
    delivered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    received_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # relationships
    purchase_order_item: Mapped["PurchaseOrderItem"] = relationship(
        "PurchaseOrderItem", back_populates="deliveries"
    )
    receiver: Mapped["User"] = relationship("User")
