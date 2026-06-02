"""orderstatus enum から acknowledged を削除。

Revision ID: r2s3t4u5v6w7
Revises: q1r2s3t4u5v6
Create Date: 2026-06-02
"""
from alembic import op

revision = "r2s3t4u5v6w7"
down_revision = "q1r2s3t4u5v6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # acknowledged レコードを sent に変換
    op.execute("UPDATE orders SET status = 'sent' WHERE status = 'acknowledged'")
    # 列を varchar に一時変換 → enum 再作成 → 列を戻す
    op.execute("ALTER TABLE orders ALTER COLUMN status TYPE varchar(50) USING status::varchar")
    op.execute("DROP TYPE IF EXISTS orderstatus")
    op.execute("CREATE TYPE orderstatus AS ENUM ('draft', 'sent', 'signed', 'cancelled')")
    op.execute("ALTER TABLE orders ALTER COLUMN status TYPE orderstatus USING status::orderstatus")


def downgrade() -> None:
    op.execute("ALTER TABLE orders ALTER COLUMN status TYPE varchar(50) USING status::varchar")
    op.execute("DROP TYPE IF EXISTS orderstatus")
    op.execute("CREATE TYPE orderstatus AS ENUM ('draft', 'sent', 'signed', 'acknowledged', 'cancelled')")
    op.execute("ALTER TABLE orders ALTER COLUMN status TYPE orderstatus USING status::orderstatus")
