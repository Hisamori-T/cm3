"""QCDS原価算定表・直接工事費行・経費行モデル。"""
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum as SAEnum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import QCDSCategory

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.vendor import Vendor


class QCDS(Base, TimestampMixin):
    """QCDS原価算定表ヘッダ。projectと1:N（改訂版対応）。"""

    __tablename__ = "qcds"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False
    )
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # 原価率・固定費
    spare_cost: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    industrial_waste_cost: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    labor_insurance_rate: Mapped[float] = mapped_column(Numeric(8, 6), nullable=False, default=0.001973)
    construction_insurance_rate: Mapped[float] = mapped_column(Numeric(8, 6), nullable=False, default=0.002095)
    special_insurance_rate: Mapped[float] = mapped_column(Numeric(8, 6), nullable=False, default=0.000110)
    office_supplies: Mapped[float] = mapped_column(Numeric(12, 0), nullable=False, default=2000)
    communication_cost: Mapped[float] = mapped_column(Numeric(12, 0), nullable=False, default=10000)
    misc_cost: Mapped[float] = mapped_column(Numeric(12, 0), nullable=False, default=5000)

    # 経費率
    site_staff_salary_rate: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False, default=0.035)
    common_overhead_rate: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    shared_overhead_rate: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False, default=0.05)
    general_admin_rate: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False, default=0.035)
    target_operating_profit_rate: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False, default=0.10)
    actual_site_personnel_cost: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)

    # relationships
    project: Mapped["Project"] = relationship("Project", back_populates="qcds")
    direct_works: Mapped[list["QCDSDirectWork"]] = relationship(
        "QCDSDirectWork", back_populates="qcds", order_by="QCDSDirectWork.row_no"
    )
    expense_items: Mapped[list["QCDSExpenseItem"]] = relationship(
        "QCDSExpenseItem", back_populates="qcds",
        order_by="(QCDSExpenseItem.section, QCDSExpenseItem.row_no)",
        cascade="all, delete-orphan",
    )


class QCDSDirectWork(Base):
    """QCDS 直接工事費の各行（取決見通表 1〜30行）。"""

    __tablename__ = "qcds_direct_works"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    qcds_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("qcds.id"), nullable=False
    )
    row_no: Mapped[int] = mapped_column(Integer, nullable=False)
    work_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    vendor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=True
    )
    vendor_name_snapshot: Mapped[str | None] = mapped_column(String(200), nullable=True)
    category: Mapped[QCDSCategory | None] = mapped_column(
        SAEnum(QCDSCategory, name="qcdscategory"), nullable=True
    )
    budget_amount: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    agreed_amount: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    settlement_amount: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    agreement_checked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # 月別支払額（4月〜3月）
    payment_month_4: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    payment_month_5: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    payment_month_6: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    payment_month_7: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    payment_month_8: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    payment_month_9: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    payment_month_10: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    payment_month_11: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    payment_month_12: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    payment_month_1: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    payment_month_2: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    payment_month_3: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    payment_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # スキャン由来参照
    source_scan_result_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scan_results.id", ondelete="SET NULL"), nullable=True
    )

    # relationships
    qcds: Mapped["QCDS"] = relationship("QCDS", back_populates="direct_works")
    vendor: Mapped["Vendor | None"] = relationship("Vendor")


class QCDSExpenseItem(Base, TimestampMixin):
    """QCDS経費行。標準項目（自動計算 or 上書き）とカスタム追加行の両方を管理する。"""

    __tablename__ = "qcds_expense_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    qcds_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("qcds.id", ondelete="CASCADE"), nullable=False
    )
    section: Mapped[str] = mapped_column(
        String(20), nullable=False,
        comment="B_site=現場経費 / B_dept=事業部経費 / C=その他経費",
    )
    row_no: Mapped[int] = mapped_column(Integer, nullable=False)
    system_key: Mapped[str | None] = mapped_column(
        String(50), nullable=True,
        comment="標準項目キー。NULLはカスタム行",
    )
    item_name: Mapped[str] = mapped_column(String(200), nullable=False)
    formula_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    amount_override: Mapped[float | None] = mapped_column(
        Numeric(12, 0), nullable=True,
        comment="手動上書き金額。NULLのとき system_key の自動計算値を使用",
    )
    is_custom: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # relationships
    qcds: Mapped["QCDS"] = relationship("QCDS", back_populates="expense_items")
