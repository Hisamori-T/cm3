"""add phone to users

Revision ID: z0a1b2c3d4e5
Revises: y9z0a1b2c3d4
Create Date: 2026-06-05
"""
from alembic import op
import sqlalchemy as sa

revision = "z0a1b2c3d4e5"
down_revision = "y9z0a1b2c3d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("phone", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "phone")
