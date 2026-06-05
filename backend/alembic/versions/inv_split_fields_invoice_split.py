"""invoices: split_sequence / split_count カラム追加

Revision ID: inv_split_fields
Revises: z0a1b2c3d4e5
Create Date: 2026-06-05
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "inv_split_fields"
down_revision = "z0a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("invoices", sa.Column("split_sequence", sa.Integer(), nullable=True, comment="分割請求の何枚目か (1始まり)"))
    op.add_column("invoices", sa.Column("split_total", sa.Integer(), nullable=True, comment="分割請求の総枚数"))


def downgrade() -> None:
    op.drop_column("invoices", "split_total")
    op.drop_column("invoices", "split_sequence")
