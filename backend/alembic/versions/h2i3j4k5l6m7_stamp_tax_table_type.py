"""Add table_type column to stamp_tax_table and seed contract/receipt stamp tax data.

Revision ID: h2i3j4k5l6m7
Revises: g1h2i3j4k5l6
Create Date: 2026-05-26 00:00:00.000000
"""
from __future__ import annotations

from datetime import date

from alembic import op
import sqlalchemy as sa

revision = "h2i3j4k5l6m7"
down_revision = "g1h2i3j4k5l6"
branch_labels = None
depends_on = None

_EFFECTIVE = date(2014, 4, 1)  # 軽減税率適用開始日（平成26年4月1日〜令和9年3月31日）


def upgrade() -> None:
    # ── 1. table_type カラム追加 ─────────────────────────────
    op.add_column(
        "stamp_tax_table",
        sa.Column("table_type", sa.String(20), nullable=False, server_default="contract"),
    )
    op.create_index("ix_stamp_tax_table_type", "stamp_tax_table", ["table_type"])

    # ── 2. 既存行を contract として確定 ──────────────────────
    op.execute("UPDATE stamp_tax_table SET table_type = 'contract'")

    # ── 3. 既存の契約書シードデータを削除して挿入し直す ────────
    op.execute("DELETE FROM stamp_tax_table")

    # ── 第2号文書：請負に関する契約書（令和9年3月31日まで軽減税率） ──
    contract_rows = [
        # (min, max_or_null, tax)
        (10_000,           1_000_000,    200),
        (1_000_001,        2_000_000,    400),
        (2_000_001,        3_000_000,  1_000),
        (3_000_001,        5_000_000,  2_000),
        (5_000_001,       10_000_000, 10_000),
        (10_000_001,      50_000_000, 20_000),
        (50_000_001,     100_000_000, 60_000),
        (100_000_001,    500_000_000, 100_000),
        (500_000_001,  1_000_000_000, 200_000),
        (1_000_000_001, 5_000_000_000, 400_000),
        (5_000_000_001, None,          600_000),
    ]

    # ── 第17号文書：受取書・売上領収書 ──
    receipt_rows = [
        (50_000,           1_000_000,    200),
        (1_000_001,        2_000_000,    400),
        (2_000_001,        3_000_000,    600),
        (3_000_001,        4_000_000,    800),
        (4_000_001,        5_000_000,  1_000),
        (5_000_001,        6_000_000,  1_500),
        (6_000_001,        7_000_000,  1_500),
        (7_000_001,        8_000_000,  2_000),
        (8_000_001,        9_000_000,  2_000),
        (9_000_001,       10_000_000,  2_000),
        (10_000_001,      20_000_000,  4_000),
        (20_000_001,      30_000_000,  6_000),
        (30_000_001,      40_000_000,  8_000),
        (40_000_001,      50_000_000, 10_000),
        (50_000_001,     100_000_000, 15_000),
        (100_000_001,    200_000_000, 30_000),
        (200_000_001,    300_000_000, 50_000),
        (300_000_001,    500_000_000, 100_000),
        (500_000_001,    None,        200_000),
    ]

    def _ins(table_type: str, rows: list) -> None:
        for min_a, max_a, tax in rows:
            max_val = "NULL" if max_a is None else str(max_a)
            op.execute(
                f"INSERT INTO stamp_tax_table (id, table_type, min_amount, max_amount, tax_amount, effective_from) "
                f"VALUES (gen_random_uuid(), '{table_type}', {min_a}, {max_val}, {tax}, '{_EFFECTIVE}')"
            )

    _ins("contract", contract_rows)
    _ins("receipt", receipt_rows)


def downgrade() -> None:
    op.execute("DELETE FROM stamp_tax_table")
    op.drop_index("ix_stamp_tax_table_type", table_name="stamp_tax_table")
    op.drop_column("stamp_tax_table", "table_type")
