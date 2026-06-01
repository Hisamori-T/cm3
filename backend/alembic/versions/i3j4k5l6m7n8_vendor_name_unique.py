"""vendor_name unique constraint

Revision ID: i3j4k5l6m7n8
Revises: h2i3j4k5l6m7
Create Date: 2026-05-27

"""
from alembic import op

revision = "i3j4k5l6m7n8"
down_revision = "h2i3j4k5l6m7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint("uq_vendors_vendor_name", "vendors", ["vendor_name"])


def downgrade() -> None:
    op.drop_constraint("uq_vendors_vendor_name", "vendors", type_="unique")
