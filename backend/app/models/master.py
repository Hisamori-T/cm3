"""マスタテーブル（印紙税額・採番管理・見積条件テンプレート）。"""
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class StampTaxTable(Base):
    """印紙税額テーブル。契約金額の範囲に対応する印紙税額を保持。
    table_type: 'contract'=第2号文書（請負契約）/ 'receipt'=第17号文書（受取書）
    """

    __tablename__ = "stamp_tax_table"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    table_type: Mapped[str] = mapped_column(String(20), nullable=False, default="contract")
    min_amount: Mapped[float] = mapped_column(Numeric(15, 0), nullable=False)
    max_amount: Mapped[float | None] = mapped_column(Numeric(15, 0), nullable=True)
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 0), nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)


class ProjectNumberSequence(Base):
    """工事番号採番管理。{西暦下2桁}-{社員番号}-{連番3桁} の連番部分を管理。"""

    __tablename__ = "project_number_sequences"

    year_yy: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_number: Mapped[int] = mapped_column(Integer, primary_key=True)
    last_seq: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class QuoteConditionTemplate(Base):
    """見積条件書テンプレート。新規見積作成時に選択肢として表示。"""

    __tablename__ = "quote_condition_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
