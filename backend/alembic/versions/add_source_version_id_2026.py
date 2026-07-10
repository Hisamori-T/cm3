"""add source_version_id to quote_items.

顧客見積明細と業者見積版を版単位で紐づける。
従来の source_vendor_id (業者IDのみ) では同一業者複数版の区別が不可能だったため追加。

Revision ID: add_source_version_id_2026
Revises: p3_status_simplify_2026
Create Date: 2026-07-10
"""
from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "add_source_version_id_2026"
down_revision = "p3_status_simplify_2026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "quote_items",
        sa.Column("source_version_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_quote_items_source_version_id",
        "quote_items",
        "quote_versions",
        ["source_version_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_quote_items_source_version_id",
        "quote_items",
        ["source_version_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_quote_items_source_version_id", table_name="quote_items")
    op.drop_constraint(
        "fk_quote_items_source_version_id", "quote_items", type_="foreignkey"
    )
    op.drop_column("quote_items", "source_version_id")
