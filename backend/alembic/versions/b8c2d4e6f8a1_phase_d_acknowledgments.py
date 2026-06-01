"""Phase D: acknowledgments テーブル追加、orders/invoices に quote連動カラム追加、ステータスenum拡張

Revision ID: b8c2d4e6f8a1
Revises: a1b2c3d4e5f6
Create Date: 2026-05-21
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "b8c2d4e6f8a1"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. orderstatus に新値を追加 ─────────────────────────────────────────
    op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'sent'")
    op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'signed'")
    op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'acknowledged'")
    op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'cancelled'")

    # ── 2. invoicestatus に新値を追加 ───────────────────────────────────────
    op.execute("ALTER TYPE invoicestatus ADD VALUE IF NOT EXISTS 'sent'")
    op.execute("ALTER TYPE invoicestatus ADD VALUE IF NOT EXISTS 'partially_paid'")
    op.execute("ALTER TYPE invoicestatus ADD VALUE IF NOT EXISTS 'overdue'")
    op.execute("ALTER TYPE invoicestatus ADD VALUE IF NOT EXISTS 'cancelled'")

    # ── 3. 既存データを新ステータスにマイグレーション ───────────────────────
    # ALTER TYPE ADD VALUE はトランザクション内では即座に反映されないため
    # COMMIT して新値を利用可能にする
    op.execute("COMMIT")
    op.execute("BEGIN")
    op.execute("UPDATE orders SET status = 'sent'   WHERE status = 'issued'")
    op.execute("UPDATE orders SET status = 'signed' WHERE status = 'signed_returned'")
    op.execute("UPDATE invoices SET status = 'sent' WHERE status = 'issued'")

    # ── 4. orders に新カラム追加 ──────────────────────────────────────────
    op.add_column("orders", sa.Column(
        "quote_id",
        postgresql.UUID(as_uuid=True),
        sa.ForeignKey("quotes.id", ondelete="SET NULL"),
        nullable=True,
    ))
    op.add_column("orders", sa.Column(
        "linked_to_quote",
        sa.Boolean(),
        nullable=False,
        server_default=sa.text("FALSE"),
    ))
    op.create_index("ix_orders_quote_id", "orders", ["quote_id"])

    # ── 5. invoices に新カラム追加 ────────────────────────────────────────
    op.add_column("invoices", sa.Column(
        "quote_id",
        postgresql.UUID(as_uuid=True),
        sa.ForeignKey("quotes.id", ondelete="SET NULL"),
        nullable=True,
    ))
    op.add_column("invoices", sa.Column(
        "linked_to_quote",
        sa.Boolean(),
        nullable=False,
        server_default=sa.text("FALSE"),
    ))
    op.create_index("ix_invoices_quote_id", "invoices", ["quote_id"])

    # ── 6. acknowledgmentstatus ENUM 新規作成 ──────────────────────────────
    acknowledgmentstatus = postgresql.ENUM(
        "draft", "issued", name="acknowledgmentstatus", create_type=False
    )
    acknowledgmentstatus.create(op.get_bind(), checkfirst=True)

    # ── 7. acknowledgments テーブル新規作成 ───────────────────────────────
    op.create_table(
        "acknowledgments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("order_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("acknowledgment_number", sa.String(50), nullable=True),
        sa.Column("issue_date", sa.Date, nullable=True),
        sa.Column("client_address", sa.String(255), nullable=True),
        sa.Column("client_company", sa.String(255), nullable=True),
        sa.Column("client_person", sa.String(100), nullable=True),
        sa.Column("amount_excl_tax", sa.Numeric(12, 0), nullable=True),
        sa.Column("tax_amount", sa.Numeric(12, 0), nullable=True),
        sa.Column("total_amount", sa.Numeric(12, 0), nullable=True),
        sa.Column("stamp_tax", sa.Numeric(12, 0), nullable=True),
        sa.Column("construction_period_start", sa.Date, nullable=True),
        sa.Column("construction_period_end", sa.Date, nullable=True),
        sa.Column("payment_condition", sa.Text, nullable=True),
        sa.Column("terms_and_conditions", sa.Text, nullable=True),
        sa.Column("status",
                  postgresql.ENUM("draft", "issued", name="acknowledgmentstatus",
                                  create_type=False),
                  nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_acknowledgments_order_id", "acknowledgments", ["order_id"])
    op.create_index("ix_acknowledgments_project_id", "acknowledgments", ["project_id"])


def downgrade() -> None:
    op.drop_table("acknowledgments")
    op.execute("DROP TYPE IF EXISTS acknowledgmentstatus")

    op.drop_index("ix_invoices_quote_id", table_name="invoices")
    op.drop_column("invoices", "linked_to_quote")
    op.drop_column("invoices", "quote_id")

    op.drop_index("ix_orders_quote_id", table_name="orders")
    op.drop_column("orders", "linked_to_quote")
    op.drop_column("orders", "quote_id")

    # 注: PostgreSQL は ADD VALUE で追加した enum 値を削除できないため
    # orderstatus / invoicestatus の追加値はdowngradeでは除去しない
