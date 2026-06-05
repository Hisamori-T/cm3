"""invoices: completion_date カラム追加

Revision ID: inv_completion_date
Revises: inv_desc_remarks
Create Date: 2026-06-05
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "inv_completion_date"
down_revision = "inv_desc_remarks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "invoices",
        sa.Column("completion_date", sa.Date(), nullable=True,
                  comment="PDF 日付列に表示する工事完了日"),
    )


def downgrade() -> None:
    op.drop_column("invoices", "completion_date")
