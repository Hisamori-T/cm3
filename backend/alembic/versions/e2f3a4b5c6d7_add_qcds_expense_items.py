"""Add qcds_expense_items table for editable/custom expense rows.

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-05-22 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "e2f3a4b5c6d7"
down_revision = "d1e2f3a4b5c6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "qcds_expense_items",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "qcds_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("qcds.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "section",
            sa.String(20),
            nullable=False,
            comment="B_site=現場経費 / B_dept=事業部経費 / C=その他経費",
        ),
        sa.Column("row_no", sa.Integer, nullable=False, comment="セクション内の表示順"),
        sa.Column(
            "system_key",
            sa.String(50),
            nullable=True,
            comment="標準項目キー（NULLはカスタム行）",
        ),
        sa.Column("item_name", sa.String(200), nullable=False),
        sa.Column("formula_description", sa.Text(), nullable=True, comment="計算式の説明テキスト"),
        sa.Column(
            "amount_override",
            sa.Numeric(12, 0),
            nullable=True,
            comment="手動上書き金額。NULLのとき system_key の自動計算値を使用",
        ),
        sa.Column(
            "is_custom",
            sa.Boolean,
            nullable=False,
            server_default="false",
            comment="True=ユーザー追加行（削除可）",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_qcds_expense_items_qcds_id",
        "qcds_expense_items",
        ["qcds_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_qcds_expense_items_qcds_id", table_name="qcds_expense_items")
    op.drop_table("qcds_expense_items")
