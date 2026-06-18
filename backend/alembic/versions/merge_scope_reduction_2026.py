"""merge: phase_h_attend と drop_scope_reduction_2026 を合流。

Revision ID: merge_scope_reduction_2026
Revises: phase_h_attend, drop_scope_reduction_2026
Create Date: 2026-06-18
"""
from __future__ import annotations

revision = "merge_scope_reduction_2026"
down_revision = ("phase_h_attend", "drop_scope_reduction_2026")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
