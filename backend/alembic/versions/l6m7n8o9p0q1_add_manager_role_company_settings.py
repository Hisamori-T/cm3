"""add manager role and company_settings table.

Revision ID: l6m7n8o9p0q1
Revises: k5l6m7n8o9p0
Create Date: 2026-05-29
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa

revision = "l6m7n8o9p0q1"
down_revision = "k5l6m7n8o9p0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # manager ロールを ENUM に追加（トランザクション外で実行）
    op.execute("COMMIT")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'manager' AFTER 'admin'")
    op.execute("BEGIN")

    # company_settings テーブル作成
    op.create_table(
        "company_settings",
        sa.Column("id", sa.String(50), primary_key=True, default="default"),
        sa.Column("company_name", sa.String(200), nullable=False, server_default="株式会社クラップ"),
        sa.Column("company_name_en", sa.String(200), nullable=True),
        sa.Column("postal_code", sa.String(10), nullable=True),
        sa.Column("address", sa.String(300), nullable=True),
        sa.Column("tel", sa.String(30), nullable=True),
        sa.Column("fax", sa.String(30), nullable=True),
        sa.Column("representative_name", sa.String(100), nullable=True),
        sa.Column("tax_registration_number", sa.String(50), nullable=True),
        sa.Column("bank_name", sa.String(100), nullable=True),
        sa.Column("bank_branch", sa.String(100), nullable=True),
        sa.Column("bank_account_type", sa.String(20), nullable=True),
        sa.Column("bank_account_number", sa.String(30), nullable=True),
        sa.Column("bank_account_holder", sa.String(100), nullable=True),
        sa.Column("logo_path", sa.String(500), nullable=True),
        sa.Column("seal_text", sa.String(10), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # デフォルトデータを挿入（株式会社クラップの情報）
    op.execute("""
        INSERT INTO company_settings (
            id, company_name, company_name_en, postal_code, address,
            tel, fax, representative_name, tax_registration_number,
            bank_name, bank_branch, bank_account_type, bank_account_number,
            bank_account_holder, seal_text
        ) VALUES (
            'default', '株式会社クラップ', 'CLAP CORPORATION', '913-0043',
            '福井県坂井市三国町錦3-4-2', '0776-81-8330', '0776-81-8331',
            '奴間 正人', 'T5210001007332', '福井銀行', '経田支店',
            '普通', '1068586', '株式会社クラップ', '奴間'
        )
        ON CONFLICT (id) DO NOTHING
    """)


def downgrade() -> None:
    op.drop_table("company_settings")
