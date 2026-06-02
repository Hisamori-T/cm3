"""orders に work_content と notes を追加。

Revision ID: q1r2s3t4u5v6
Revises: p0q1r2s3t4u5
Create Date: 2026-06-02
"""
from alembic import op
import sqlalchemy as sa

revision = "q1r2s3t4u5v6"
down_revision = "p0q1r2s3t4u5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column(
            "work_content",
            sa.Text(),
            nullable=True,
            server_default="添付工事内訳書の通り",
        ),
    )
    op.add_column(
        "orders",
        sa.Column("notes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("orders", "notes")
    op.drop_column("orders", "work_content")
