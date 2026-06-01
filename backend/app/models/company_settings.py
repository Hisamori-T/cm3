"""自社企業情報設定モデル。帳票出力に使用するシングルトン設定。"""
from __future__ import annotations

import uuid
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.models.base import TimestampMixin


class CompanySettings(TimestampMixin, Base):
    """自社企業情報。レコードは常に1件（id='default'で管理）。"""
    __tablename__ = "company_settings"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default="default")
    company_name: Mapped[str] = mapped_column(String(200), default="株式会社クラップ")
    company_name_en: Mapped[str | None] = mapped_column(String(200), nullable=True, default="CLAP CORPORATION")
    postal_code: Mapped[str | None] = mapped_column(String(10), nullable=True, default="913-0043")
    address: Mapped[str | None] = mapped_column(String(300), nullable=True, default="福井県坂井市三国町錦3-4-2")
    tel: Mapped[str | None] = mapped_column(String(30), nullable=True, default="0776-81-8330")
    fax: Mapped[str | None] = mapped_column(String(30), nullable=True, default="0776-81-8331")
    representative_name: Mapped[str | None] = mapped_column(String(100), nullable=True, default="奴間 正人")
    tax_registration_number: Mapped[str | None] = mapped_column(String(50), nullable=True, default="T5210001007332")
    bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True, default="福井銀行")
    bank_branch: Mapped[str | None] = mapped_column(String(100), nullable=True, default="経田支店")
    bank_account_type: Mapped[str | None] = mapped_column(String(20), nullable=True, default="普通")
    bank_account_number: Mapped[str | None] = mapped_column(String(30), nullable=True, default="1068586")
    bank_account_holder: Mapped[str | None] = mapped_column(String(100), nullable=True, default="株式会社クラップ")
    logo_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    seal_text: Mapped[str | None] = mapped_column(String(10), nullable=True, default="奴間")
    logo_text: Mapped[str | None] = mapped_column(String(4), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    slack_webhook_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    slack_notify_status_change: Mapped[bool] = mapped_column(default=True, nullable=False, server_default="true")
    slack_notify_payment_due: Mapped[bool] = mapped_column(default=True, nullable=False, server_default="true")
