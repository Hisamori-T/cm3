"""add logo_text to company_settings.

Revision ID: n8o9p0q1r2s3
Revises: l6m7n8o9p0q1
Create Date: 2026-05-29
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa

revision = "n8o9p0q1r2s3"
down_revision = "l6m7n8o9p0q1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("company_settings", sa.Column("logo_text", sa.String(4), nullable=True))


def downgrade() -> None:
    op.drop_column("company_settings", "logo_text")
