"""請求書・請求書明細・入金記録モデル。"""
import uuid
import sqlalchemy as sa
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, Enum as SAEnum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import BillingMethod, DeductionType, InvoicePhase, InvoiceStatus, ProjectRole

if TYPE_CHECKING:
    from app.models.project import Project


class Invoice(Base, TimestampMixin):
    """請求書ヘッダ。"""

    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False
    )
    invoice_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    issue_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    previous_balance: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    received_amount: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    outstanding_balance: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    current_purchase: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    tax_amount: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    total_amount: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    quote_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quotes.id", ondelete="SET NULL"), nullable=True
    )
    linked_to_quote: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[InvoiceStatus] = mapped_column(
        SAEnum(InvoiceStatus, name="invoicestatus"), nullable=False, default=InvoiceStatus.draft
    )
    # Phase F: 分割請求サポート
    billing_method: Mapped[BillingMethod | None] = mapped_column(
        SAEnum(BillingMethod, name="billingmethod"), nullable=True
    )
    billing_percentage: Mapped[float | None] = mapped_column(
        Numeric(5, 2), nullable=True, comment="billing_method=percentage の場合の割合（0〜100）"
    )
    billing_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    payment_due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    split_sequence: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    split_total: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    work_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    work_remarks: Mapped[str | None] = mapped_column(String(100), nullable=True)
    completion_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # v2: 総額+分割連動
    invoice_type: Mapped[str] = mapped_column(String(20), nullable=False, default="standalone")
    parent_invoice_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True
    )
    # Phase R-1: 出来高・控除・支払通知書
    invoice_phase: Mapped[InvoicePhase] = mapped_column(
        SAEnum(InvoicePhase, name="invoicephase"), nullable=False, default=InvoicePhase.none
    )
    project_role_snapshot: Mapped[str | None] = mapped_column(String(20), nullable=True)
    contract_amount_snapshot: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    total_deduction_amount: Mapped[float] = mapped_column(Numeric(12, 0), nullable=False, default=0)
    final_payable_amount: Mapped[float] = mapped_column(Numeric(12, 0), nullable=False, default=0)

    # relationships
    project: Mapped["Project"] = relationship("Project", back_populates="invoices")
    items: Mapped[list["InvoiceItem"]] = relationship(
        "InvoiceItem", back_populates="invoice", order_by="InvoiceItem.row_no"
    )
    payments: Mapped[list["Payment"]] = relationship(
        "Payment", foreign_keys="Payment.invoice_id",
        back_populates="invoice", order_by="Payment.payment_date", cascade="all, delete-orphan"
    )
    children: Mapped[list["Invoice"]] = relationship(
        "Invoice", foreign_keys="Invoice.parent_invoice_id",
        back_populates="parent", order_by="Invoice.split_sequence",
    )
    parent: Mapped["Invoice | None"] = relationship(
        "Invoice", foreign_keys=[parent_invoice_id], back_populates="children", remote_side="Invoice.id"
    )
    deductions: Mapped[list["InvoiceDeduction"]] = relationship(
        "InvoiceDeduction",
        back_populates="invoice",
        primaryjoin="and_(InvoiceDeduction.invoice_id == Invoice.id, InvoiceDeduction.is_deleted == False)",  # noqa: E712
        order_by="InvoiceDeduction.row_no",
    )


class InvoiceDeduction(Base, TimestampMixin):
    """請求書控除項目（元請→下請 支払通知書用）。"""

    __tablename__ = "invoice_deductions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    deduction_type: Mapped[DeductionType] = mapped_column(
        SAEnum(DeductionType, name="deductiontype"), nullable=False
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 0), nullable=False)
    calculation_rate: Mapped[float | None] = mapped_column(Numeric(8, 4), nullable=True)
    account_hint: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    row_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # relationships
    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="deductions", foreign_keys=[invoice_id])


class InvoiceItem(Base):
    """請求書明細行。"""

    __tablename__ = "invoice_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False
    )
    row_no: Mapped[int] = mapped_column(Integer, nullable=False)
    item_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    amount: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # relationships
    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="items")


class Payment(Base, TimestampMixin):
    """入金記録。請求書1件に対して複数回の入金を管理する。"""

    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 0), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    payment_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_split_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True
    )

    # relationships
    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="payments", foreign_keys=[invoice_id])
