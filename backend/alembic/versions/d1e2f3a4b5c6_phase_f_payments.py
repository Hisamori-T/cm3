"""Phase F: payments table, billing_method enum, invoice billing columns.

Revision ID: d1e2f3a4b5c6
Revises: c1d2e3f4a5b6
Create Date: 2026-05-21 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "d1e2f3a4b5c6"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL ENUMは COMMIT前にADD VALUEできないため、先に型を作成してからDDLを発行する
    billing_method_enum = postgresql.ENUM(
        "direct_amount", "percentage", "item_selection",
        name="billingmethod",
        create_type=False,
    )
    billing_method_enum.create(op.get_bind(), checkfirst=True)

    # invoices テーブルに請求方法カラムを追加
    op.add_column("invoices", sa.Column(
        "billing_method",
        sa.Enum("direct_amount", "percentage", "item_selection", name="billingmethod"),
        nullable=True,
    ))
    op.add_column("invoices", sa.Column(
        "billing_percentage",
        sa.Numeric(precision=5, scale=2),
        nullable=True,
        comment="billing_method=percentage の場合の請求割合（0〜100）",
    ))
    op.add_column("invoices", sa.Column(
        "billing_note",
        sa.Text(),
        nullable=True,
        comment="請求内訳メモ・分割根拠など",
    ))
    op.add_column("invoices", sa.Column(
        "payment_due_date",
        sa.Date(),
        nullable=True,
        comment="支払期日",
    ))

    # payments テーブルを新規作成
    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=0), nullable=False, comment="入金額（円単位）"),
        sa.Column("payment_date", sa.Date(), nullable=False, comment="入金日"),
        sa.Column("payment_method", sa.String(50), nullable=True, comment="振込・現金・手形 等"),
        sa.Column("note", sa.Text(), nullable=True, comment="備考"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_payments_invoice_id", "payments", ["invoice_id"])

    # project_invoice_summary ビュー（案件ごとの請求・入金サマリ）
    op.execute("""
        CREATE OR REPLACE VIEW project_invoice_summary AS
        SELECT
            i.project_id,
            COUNT(i.id)                                          AS invoice_count,
            COALESCE(SUM(i.total_amount), 0)                    AS total_billed,
            COALESCE(SUM(p.paid), 0)                            AS total_paid,
            COALESCE(SUM(i.total_amount), 0)
                - COALESCE(SUM(p.paid), 0)                      AS outstanding,
            MAX(i.payment_due_date)                             AS latest_due_date
        FROM invoices i
        LEFT JOIN (
            SELECT invoice_id, SUM(amount) AS paid
            FROM payments
            GROUP BY invoice_id
        ) p ON p.invoice_id = i.id
        WHERE i.status != 'cancelled'
        GROUP BY i.project_id
    """)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS project_invoice_summary")
    op.drop_index("ix_payments_invoice_id", table_name="payments")
    op.drop_table("payments")
    op.drop_column("invoices", "payment_due_date")
    op.drop_column("invoices", "billing_note")
    op.drop_column("invoices", "billing_percentage")
    op.drop_column("invoices", "billing_method")
    op.execute("DROP TYPE IF EXISTS billingmethod")
