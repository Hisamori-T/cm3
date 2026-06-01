"""phase1a: source_type, acknowledgement_status, payment_schedules

Revision ID: j4k5l6m7n8o9
Revises: i3j4k5l6m7n8
Create Date: 2026-05-28

"""
from alembic import op
import sqlalchemy as sa

revision = "j4k5l6m7n8o9"
down_revision = "i3j4k5l6m7n8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # quote_items: 入力元種別
    op.add_column(
        "quote_items",
        sa.Column("source_type", sa.String(20), nullable=True, server_default="manual"),
    )

    # orders: 注文請書ステータス
    op.add_column(
        "orders",
        sa.Column(
            "acknowledgement_status",
            sa.String(20),
            nullable=False,
            server_default="none",
        ),
    )

    # payment_schedules: 入金予定管理
    op.create_table(
        "payment_schedules",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("invoice_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("invoices.id"), nullable=True),
        sa.Column("scheduled_date", sa.Date, nullable=False),
        sa.Column("expected_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("actual_date", sa.Date, nullable=True),
        sa.Column("actual_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("notified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )


def downgrade() -> None:
    op.drop_table("payment_schedules")
    op.drop_column("orders", "acknowledgement_status")
    op.drop_column("quote_items", "source_type")
