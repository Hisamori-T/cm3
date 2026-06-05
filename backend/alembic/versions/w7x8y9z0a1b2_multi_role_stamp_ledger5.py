"""複数ロール対応 + 印影設定 + 工事台帳承認5枠変更。

Revision ID: w7x8y9z0a1b2
Revises: v6w7x8y9z0a1
Create Date: 2026-06-04
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

revision = "w7x8y9z0a1b2"
down_revision = "v6w7x8y9z0a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ─── 1. users: roles 配列カラム追加 ───────────────────────────────────
    # PostgreSQL の userrole ENUM を配列として使用
    op.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS roles userrole[]
        NOT NULL DEFAULT '{member}'::userrole[]
    """)
    # 既存ユーザーの role → roles に移行（単一要素配列）
    op.execute("UPDATE users SET roles = ARRAY[role]::userrole[]")

    # ─── 2. users: 印影設定カラム追加 ────────────────────────────────────
    op.add_column("users", sa.Column(
        "stamp_text", sa.String(10), nullable=True,
        comment="印影テキスト（漢字2〜4文字）",
    ))
    op.add_column("users", sa.Column(
        "stamp_style", sa.String(20), nullable=True, server_default="circle-red",
        comment="印影スタイル: circle-red|circle-navy|square-red|square-navy",
    ))

    # ─── 3. ledger_approvals: 承認枠を5枠に変更 ──────────────────────────
    # 「担当」→「現場担当」に変更
    op.execute("""
        UPDATE ledger_approvals
        SET role_label = '現場担当', display_order = 3
        WHERE role_label = '担当'
    """)
    # 全案件に「営業担当」枠を追加（重複回避）
    op.execute("""
        INSERT INTO ledger_approvals (id, project_id, role_label, display_order, created_at)
        SELECT
            gen_random_uuid(),
            p.id,
            '営業担当',
            4,
            now()
        FROM projects p
        WHERE p.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM ledger_approvals la
            WHERE la.project_id = p.id AND la.role_label = '営業担当'
          )
    """)

    # display_order 確認用インデックス（idempotent）
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_ledger_approvals_project_role
        ON ledger_approvals (project_id, role_label)
    """)


def downgrade() -> None:
    # 営業担当 枠を削除
    op.execute("DELETE FROM ledger_approvals WHERE role_label = '営業担当'")
    # 現場担当 → 担当 に戻す
    op.execute("""
        UPDATE ledger_approvals
        SET role_label = '担当', display_order = 3
        WHERE role_label = '現場担当'
    """)
    # 印影カラム削除
    op.drop_column("users", "stamp_style")
    op.drop_column("users", "stamp_text")
    # roles カラム削除
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS roles")
