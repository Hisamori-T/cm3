"""add approved to quotestatus enum."""
from alembic import op

revision = "a1b2c3d4e5f6"
down_revision = "z0a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE quotestatus ADD VALUE IF NOT EXISTS 'approved'")


def downgrade() -> None:
    # PostgreSQL では enum 値の削除は不可（再作成が必要）
    pass
