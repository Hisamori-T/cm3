"""extend user roles: add staff, legacy, accounting; migrate member->staff

Revision ID: k5l6m7n8o9p0
Revises: j4k5l6m7n8o9
Create Date: 2026-05-28

"""
from alembic import op
import sqlalchemy as sa

revision = "k5l6m7n8o9p0"
down_revision = "j4k5l6m7n8o9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL の Enum 型への値追加は DDL のため別トランザクションが必要
    # alembic_version を先にコミットしてから ADD VALUE を実行する
    connection = op.get_bind()
    # COMMIT して現在のトランザクションを終了、ADD VALUE を独立 DDL として実行
    connection.execute(sa.text("COMMIT"))
    connection.execute(sa.text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'staff'"))
    connection.execute(sa.text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'legacy'"))
    connection.execute(sa.text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'accounting'"))
    # 新しいトランザクションで UPDATE
    connection.execute(sa.text("BEGIN"))
    connection.execute(sa.text("UPDATE users SET role = 'staff' WHERE role = 'member'"))


def downgrade() -> None:
    op.execute("UPDATE users SET role = 'member' WHERE role = 'staff'")
