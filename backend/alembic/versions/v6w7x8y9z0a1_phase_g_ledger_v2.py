"""Phase G v2: ledger_approvals に押印依頼フィールド追加 + project_ledger_meta に expense_overrides 追加。

Revision ID: v6w7x8y9z0a1
Revises: u5v6w7x8y9z0
Create Date: 2026-06-04
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "v6w7x8y9z0a1"
down_revision = "u5v6w7x8y9z0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ledger_approvals: 押印依頼フィールド追加
    op.add_column("ledger_approvals", sa.Column(
        "approver_user_id", UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        comment="押印依頼を受ける人",
    ))
    op.add_column("ledger_approvals", sa.Column(
        "requested_by_id", UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        comment="押印依頼を送った人",
    ))
    op.add_column("ledger_approvals", sa.Column(
        "requested_at", sa.DateTime(timezone=True), nullable=True,
        comment="押印依頼日時",
    ))

    # project_ledger_meta: 現場経費手動上書き
    op.add_column("project_ledger_meta", sa.Column(
        "expense_overrides", JSONB, nullable=True,
        comment="現場経費6項目の手動上書き値 {system_key: amount}",
    ))


def downgrade() -> None:
    op.drop_column("project_ledger_meta", "expense_overrides")
    op.drop_column("ledger_approvals", "requested_at")
    op.drop_column("ledger_approvals", "requested_by_id")
    op.drop_column("ledger_approvals", "approver_user_id")
