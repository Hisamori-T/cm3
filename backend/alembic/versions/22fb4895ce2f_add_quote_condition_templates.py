"""add_quote_condition_templates

Revision ID: 22fb4895ce2f
Revises: 5701fe81df0d
Create Date: 2026-05-14 06:50:49.909354

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "22fb4895ce2f"
down_revision: Union[str, None] = "5701fe81df0d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "quote_condition_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    # vendor_price_histories の FK（初期マイグレーションで未追加分）
    try:
        op.create_foreign_key(
            "fk_vph_vendor_id", "vendor_price_histories", "vendors", ["vendor_id"], ["id"]
        )
    except Exception:
        pass
    try:
        op.create_foreign_key(
            "fk_vph_project_id", "vendor_price_histories", "projects", ["project_id"], ["id"]
        )
    except Exception:
        pass


def downgrade() -> None:
    op.drop_table("quote_condition_templates")
    op.drop_constraint("fk_vph_vendor_id", "vendor_price_histories", type_="foreignkey")
    op.drop_constraint("fk_vph_project_id", "vendor_price_histories", type_="foreignkey")
