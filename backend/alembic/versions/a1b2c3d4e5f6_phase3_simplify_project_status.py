"""Phase 3: ProjectStatus enum を 4値に簡略化。

旧: quote/ordered/started/in_progress/completed/billed/paid (7値)
新: draft/submitted/won/lost (4値)

既存データは全件 draft に移行（テストデータのみ）。

Revision ID: a1b2c3d4e5f6
Revises: 68992a598db0
Create Date: 2026-07-09
"""
from __future__ import annotations

from alembic import op

revision = "a1b2c3d4e5f6"
down_revision = "68992a598db0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE TYPE projectstatus_new AS ENUM ('draft', 'submitted', 'won', 'lost')")
    op.execute(
        "ALTER TABLE projects ALTER COLUMN status "
        "TYPE projectstatus_new USING 'draft'::projectstatus_new"
    )
    op.execute("DROP TYPE projectstatus")
    op.execute("ALTER TYPE projectstatus_new RENAME TO projectstatus")


def downgrade() -> None:
    op.execute(
        "CREATE TYPE projectstatus_old AS ENUM "
        "('quote', 'ordered', 'started', 'in_progress', 'completed', 'billed', 'paid')"
    )
    op.execute(
        "ALTER TABLE projects ALTER COLUMN status "
        "TYPE projectstatus_old USING 'quote'::projectstatus_old"
    )
    op.execute("DROP TYPE projectstatus")
    op.execute("ALTER TYPE projectstatus_old RENAME TO projectstatus")
