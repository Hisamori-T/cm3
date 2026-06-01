"""見積書・見積内訳・業者見積版・大項目モデル。"""
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, Enum as SAEnum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import QuoteStatus

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.scan import ScanResult
    from app.models.user import User
    from app.models.vendor import Vendor


class Quote(Base, TimestampMixin):
    """見積書ヘッダ（案件に1つ自動生成される）。"""

    __tablename__ = "quotes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False
    )
    quote_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    issue_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    validity_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    project_name_snapshot: Mapped[str | None] = mapped_column(String(255), nullable=True)
    project_location_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    payment_condition: Mapped[str | None] = mapped_column(Text, nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    conditions_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    subtotal: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    tax_amount: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    total_amount: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    discount_amount: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    # 稟議承認（担当者・査閲・承認）
    person_in_charge_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    person_in_charge_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approver_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[QuoteStatus] = mapped_column(
        SAEnum(QuoteStatus, name="quotestatus"), nullable=False, default=QuoteStatus.draft
    )

    # relationships
    project: Mapped["Project"] = relationship("Project", back_populates="quotes")
    versions: Mapped[list["QuoteVersion"]] = relationship(
        "QuoteVersion", back_populates="quote", order_by="QuoteVersion.version_no", cascade="all, delete-orphan"
    )
    sections: Mapped[list["QuoteSection"]] = relationship(
        "QuoteSection", back_populates="quote", order_by="QuoteSection.row_no", cascade="all, delete-orphan"
    )
    items: Mapped[list["QuoteItem"]] = relationship(
        "QuoteItem", back_populates="quote", order_by="QuoteItem.row_no"
    )


class QuoteVersion(Base, TimestampMixin):
    """業者見積版（1案件に複数版、各版に明細行）。"""

    __tablename__ = "quote_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quote_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quotes.id", ondelete="CASCADE"), nullable=False
    )
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    vendor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=True)
    vendor_name_snapshot: Mapped[str | None] = mapped_column(String(200), nullable=True)
    markup_rate: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False, default=1.0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # relationships
    quote: Mapped["Quote"] = relationship("Quote", back_populates="versions")
    vendor: Mapped["Vendor | None"] = relationship("Vendor")
    items: Mapped[list["QuoteItem"]] = relationship(
        "QuoteItem", back_populates="version", order_by="QuoteItem.row_no",
        foreign_keys="QuoteItem.version_id"
    )


class QuoteSection(Base):
    """顧客見積の大項目（A工事、B工事 …）。"""

    __tablename__ = "quote_sections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quote_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quotes.id", ondelete="CASCADE"), nullable=False
    )
    section_letter: Mapped[str] = mapped_column(String(3), nullable=False)
    section_name: Mapped[str] = mapped_column(String(200), nullable=False)
    row_no: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)

    # relationships
    quote: Mapped["Quote"] = relationship("Quote", back_populates="sections")
    items: Mapped[list["QuoteItem"]] = relationship(
        "QuoteItem", back_populates="section", order_by="QuoteItem.row_no",
        foreign_keys="QuoteItem.section_id"
    )


class QuoteItem(Base):
    """見積内訳明細行（業者版に属し、大項目にも属する）。"""

    __tablename__ = "quote_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quote_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quotes.id"), nullable=False
    )
    version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quote_versions.id", ondelete="SET NULL"), nullable=True
    )
    section_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quote_sections.id", ondelete="SET NULL"), nullable=True
    )
    row_no: Mapped[int] = mapped_column(Integer, nullable=False)
    item_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    spec: Mapped[str | None] = mapped_column(Text, nullable=True)
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    quantity: Mapped[float | None] = mapped_column(Numeric(12, 3), nullable=True)
    cost_price: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    item_markup_rate: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    unit_price: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    amount: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    remarks: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_vendor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=True
    )
    source_scan_result_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    source_type: Mapped[str | None] = mapped_column(
        String(20), nullable=True, server_default="manual"
    )

    # relationships
    quote: Mapped["Quote"] = relationship("Quote", back_populates="items", foreign_keys=[quote_id])
    version: Mapped["QuoteVersion | None"] = relationship("QuoteVersion", back_populates="items", foreign_keys=[version_id])
    section: Mapped["QuoteSection | None"] = relationship("QuoteSection", back_populates="items", foreign_keys=[section_id])
    source_vendor: Mapped["Vendor | None"] = relationship("Vendor", foreign_keys=[source_vendor_id])
