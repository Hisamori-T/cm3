"""Phase 2: projects テーブルから不要フィールドを削除。

見積管理アプリへの移行に伴い、以下のカラムを削除する:
- original_client_name, order_type, contract_type, awarding_type
- payment_condition, prev_construction_type, prev_construction_year, prev_construction_other
- period_contract_start, period_contract_end, period_actual_start, period_actual_end

Revision ID: 68992a598db0
Revises: merge_scope_reduction_2026
Create Date: 2026-07-09
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "68992a598db0"
down_revision = "merge_scope_reduction_2026"
branch_labels = None
depends_on = None

_DROP_COLS = [
    "original_client_name",
    "period_contract_start",
    "period_contract_end",
    "period_actual_start",
    "period_actual_end",
    "order_type",
    "contract_type",
    "awarding_type",
    "payment_condition",
    "prev_construction_type",
    "prev_construction_year",
    "prev_construction_other",
]


def upgrade() -> None:
    for col in _DROP_COLS:
        op.drop_column("projects", col)


def downgrade() -> None:
    op.add_column("projects", sa.Column("original_client_name", sa.String(255), nullable=True))
    op.add_column("projects", sa.Column("period_contract_start", sa.Date(), nullable=True))
    op.add_column("projects", sa.Column("period_contract_end", sa.Date(), nullable=True))
    op.add_column("projects", sa.Column("period_actual_start", sa.Date(), nullable=True))
    op.add_column("projects", sa.Column("period_actual_end", sa.Date(), nullable=True))
    op.add_column("projects", sa.Column("payment_condition", sa.Text(), nullable=True))
    op.add_column("projects", sa.Column("prev_construction_year", sa.Integer(), nullable=True))
    op.add_column("projects", sa.Column("prev_construction_other", sa.String(255), nullable=True))
