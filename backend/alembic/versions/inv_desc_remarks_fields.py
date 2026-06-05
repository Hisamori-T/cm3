"""invoices: work_description / work_remarks カラム追加

Revision ID: inv_desc_remarks
Revises: invoice_split_v2
Create Date: 2026-06-05
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "inv_desc_remarks"
down_revision = "invoice_split_v2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "invoices",
        sa.Column("work_description", sa.Text(), nullable=True,
                  comment="PDF 工事名・備考欄に追記するテキスト"),
    )
    op.add_column(
        "invoices",
        sa.Column("work_remarks", sa.String(100), nullable=True,
                  comment="PDF 摘要欄に表示するテキスト"),
    )


def downgrade() -> None:
    op.drop_column("invoices", "work_remarks")
    op.drop_column("invoices", "work_description")
