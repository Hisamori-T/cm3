"""add_quote_versions_sections

Revision ID: d9f3a2c7e1b8
Revises: 22fb4895ce2f
Create Date: 2026-05-15 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d9f3a2c7e1b8"
down_revision: Union[str, None] = "b3e8f91a2c4d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # quote_versions: 業者見積版
    op.create_table(
        "quote_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("quote_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("quotes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_no", sa.Integer(), nullable=False),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendors.id"), nullable=True),
        sa.Column("vendor_name_snapshot", sa.String(200), nullable=True),
        sa.Column("markup_rate", sa.Numeric(5, 4), nullable=False, server_default="1.0000"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_quote_versions_quote_id", "quote_versions", ["quote_id"])

    # quote_sections: 顧客見積の大項目 (A, B, C...)
    op.create_table(
        "quote_sections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("quote_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("quotes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("section_letter", sa.String(3), nullable=False),
        sa.Column("section_name", sa.String(200), nullable=False),
        sa.Column("row_no", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 0), nullable=True),
    )
    op.create_index("ix_quote_sections_quote_id", "quote_sections", ["quote_id"])

    # quote_items に版・大項目・原価フィールドを追加
    op.add_column("quote_items", sa.Column("version_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("quote_versions.id", ondelete="SET NULL"), nullable=True))
    op.add_column("quote_items", sa.Column("section_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("quote_sections.id", ondelete="SET NULL"), nullable=True))
    op.add_column("quote_items", sa.Column("cost_price", sa.Numeric(12, 0), nullable=True))
    op.add_column("quote_items", sa.Column("item_markup_rate", sa.Numeric(5, 4), nullable=True))

    # quotes に割引・稟議承認タイムスタンプを追加
    op.add_column("quotes", sa.Column("discount_amount", sa.Numeric(12, 0), nullable=True))
    op.add_column("quotes", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("quotes", sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("quotes", sa.Column("person_in_charge_confirmed_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("quotes", "person_in_charge_confirmed_at")
    op.drop_column("quotes", "reviewed_at")
    op.drop_column("quotes", "approved_at")
    op.drop_column("quotes", "discount_amount")
    op.drop_column("quote_items", "item_markup_rate")
    op.drop_column("quote_items", "cost_price")
    op.drop_column("quote_items", "section_id")
    op.drop_column("quote_items", "version_id")
    op.drop_index("ix_quote_sections_quote_id", "quote_sections")
    op.drop_table("quote_sections")
    op.drop_index("ix_quote_versions_quote_id", "quote_versions")
    op.drop_table("quote_versions")
