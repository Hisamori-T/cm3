"""工事台帳 手動入力補完・承認モデル。"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class ProjectLedgerMeta(Base, TimestampMixin):
    """工事台帳の手動入力補完データ（案件1件につき1行）。

    projects テーブルに存在しないフィールドのみ保持する:
    - original_client_name / prev_construction_year / prev_construction_other は projects.* に既存
    - period_actual_start/end は projects.period_actual_start/end に既存
    """

    __tablename__ = "project_ledger_meta"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    information_history: Mapped[str | None] = mapped_column(Text, nullable=True)
    client_requirements: Mapped[str | None] = mapped_column(Text, nullable=True)
    prev_construction_self: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    target_profit_rate: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    target_profit_amount: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)

    project: Mapped["Project"] = relationship("Project", back_populates="ledger_meta")


class LedgerApproval(Base):
    """工事台帳承認枠（社長・建築部長・経理・担当 の4枠）。"""

    __tablename__ = "ledger_approvals"
    __table_args__ = (UniqueConstraint("project_id", "role_label", name="uq_ledger_approvals_project_role"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    role_label: Mapped[str] = mapped_column(String(30), nullable=False)
    approver_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )

    project: Mapped["Project"] = relationship("Project", back_populates="ledger_approvals")
    approver: Mapped["User | None"] = relationship("User")
