"""invoices: invoice_type / parent_invoice_id / payments: target_split_id

Revision ID: invoice_split_v2
Revises: inv_split_fields
Create Date: 2026-06-06
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "invoice_split_v2"
down_revision = "inv_split_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "invoices",
        sa.Column("invoice_type", sa.String(20), nullable=False, server_default="standalone"),
    )
    op.add_column(
        "invoices",
        sa.Column(
            "parent_invoice_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("invoices.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "payments",
        sa.Column(
            "target_split_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("invoices.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("payments", "target_split_id")
    op.drop_column("invoices", "parent_invoice_id")
    op.drop_column("invoices", "invoice_type")
