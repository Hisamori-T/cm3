"""add payment_due_date to purchase_orders

Revision ID: p0q1r2s3t4u5
Revises: o9p0q1r2s3t4
Create Date: 2026-06-01

"""
from alembic import op
import sqlalchemy as sa

revision = "p0q1r2s3t4u5"
down_revision = "o9p0q1r2s3t4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("purchase_orders", sa.Column("payment_due_date", sa.Date(), nullable=True))
    op.add_column("purchase_orders", sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("purchase_orders", "paid_at")
    op.drop_column("purchase_orders", "payment_due_date")
