"""add slack_webhook_url to company_settings.

Revision ID: o9p0q1r2s3t4
Revises: n8o9p0q1r2s3
Create Date: 2026-06-01
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa

revision = "o9p0q1r2s3t4"
down_revision = "n8o9p0q1r2s3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("company_settings", sa.Column("slack_webhook_url", sa.String(500), nullable=True))
    op.add_column("company_settings", sa.Column("slack_notify_status_change", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("company_settings", sa.Column("slack_notify_payment_due", sa.Boolean(), nullable=False, server_default="true"))


def downgrade() -> None:
    op.drop_column("company_settings", "slack_notify_payment_due")
    op.drop_column("company_settings", "slack_notify_status_change")
    op.drop_column("company_settings", "slack_webhook_url")
