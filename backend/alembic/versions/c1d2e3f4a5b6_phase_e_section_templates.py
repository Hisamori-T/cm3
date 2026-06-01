"""phase_e_section_templates

Revision ID: c1d2e3f4a5b6
Revises: b8c2d4e6f8a1
Create Date: 2026-05-21 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, None] = "b8c2d4e6f8a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 大項目テンプレ本体
    op.create_table(
        "section_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("template_name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # テンプレ内大項目構成
    op.create_table(
        "section_template_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "section_template_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("section_templates.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("section_code", sa.String(3), nullable=False),
        sa.Column("section_name", sa.String(200), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("default_items", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index(
        "ix_section_template_items_template_id",
        "section_template_items",
        ["section_template_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_section_template_items_template_id", "section_template_items")
    op.drop_table("section_template_items")
    op.drop_table("section_templates")
