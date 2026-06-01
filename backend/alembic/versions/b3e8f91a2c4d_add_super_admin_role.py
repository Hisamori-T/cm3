"""add_super_admin_role

Revision ID: b3e8f91a2c4d
Revises: 22fb4895ce2f
Create Date: 2026-05-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b3e8f91a2c4d"
down_revision: Union[str, None] = "22fb4895ce2f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PostgreSQL の enum 型に super_admin 値を追加する
    # IF NOT EXISTS は PostgreSQL 9.3+ でサポート（本番環境は 16 なので問題なし）
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'super_admin'")


def downgrade() -> None:
    # PostgreSQL は enum 値の削除をサポートしないため no-op
    pass
