"""add_soft_delete_to_scan

Revision ID: f1e9c8b7a6d5
Revises: d9f3a2c7e1b8
Create Date: 2026-05-19 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f1e9c8b7a6d5"
down_revision: Union[str, None] = "d9f3a2c7e1b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # scan_jobs に論理削除カラム追加
    op.add_column("scan_jobs", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("scan_jobs", sa.Column(
        "deleted_by", postgresql.UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    ))
    op.create_index("ix_scan_jobs_deleted_at", "scan_jobs", ["deleted_at"])

    # scan_results に論理削除カラム追加
    op.add_column("scan_results", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("scan_results", sa.Column(
        "deleted_by", postgresql.UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    ))
    op.create_index("ix_scan_results_deleted_at", "scan_results", ["deleted_at"])

    # qcds_direct_works にスキャン由来参照カラム追加
    op.add_column("qcds_direct_works", sa.Column(
        "source_scan_result_id", postgresql.UUID(as_uuid=True),
        sa.ForeignKey("scan_results.id", ondelete="SET NULL"), nullable=True,
    ))


def downgrade() -> None:
    op.drop_column("qcds_direct_works", "source_scan_result_id")
    op.drop_index("ix_scan_results_deleted_at", "scan_results")
    op.drop_column("scan_results", "deleted_by")
    op.drop_column("scan_results", "deleted_at")
    op.drop_index("ix_scan_jobs_deleted_at", "scan_jobs")
    op.drop_column("scan_jobs", "deleted_by")
    op.drop_column("scan_jobs", "deleted_at")
