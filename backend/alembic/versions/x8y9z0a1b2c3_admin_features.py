"""管理者機能: 承認ルート・基本契約約款・QCDSテンプレート。

Revision ID: x8y9z0a1b2c3
Revises: w7x8y9z0a1b2
Create Date: 2026-06-04
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "x8y9z0a1b2c3"
down_revision = "w7x8y9z0a1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ─── 承認ルート設定（company_settings に JSONB カラムとして追加）───────────
    op.execute("""
        ALTER TABLE company_settings
        ADD COLUMN IF NOT EXISTS approval_route_config JSONB
        DEFAULT '{"quote_approval_steps": [
            {"step": 1, "label": "担当", "required_roles": ["staff", "member", "accounting", "manager", "admin", "super_admin"]},
            {"step": 2, "label": "確認", "required_roles": ["manager", "admin", "super_admin"]},
            {"step": 3, "label": "承認", "required_roles": ["admin", "super_admin"]}
        ]}'::jsonb
    """)

    # ─── 基本契約約款テーブル ─────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS contract_clauses (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clause_no   INTEGER NOT NULL,
            title       VARCHAR(200) NOT NULL,
            content     TEXT NOT NULL,
            is_active   BOOLEAN NOT NULL DEFAULT TRUE,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    # デフォルト約款（第1〜9条）を挿入
    op.execute("""
        INSERT INTO contract_clauses (clause_no, title, content) VALUES
        (1, '請負代金の支払', '甲は、乙の請求に基づき、前条に定める請負代金を支払うものとします。'),
        (2, '工事の施工', '乙は、設計図書・仕様書に従い、善良な管理者の注意をもって工事を施工するものとします。'),
        (3, '工期の変更', '天災その他やむを得ない事由により工期の変更が必要な場合、甲乙協議の上決定するものとします。'),
        (4, '検査及び引渡', '工事完成後、甲は速やかに検査を行い、合格後に引渡しを受けるものとします。'),
        (5, '瑕疵担保', '乙は引渡し後1年間、工事目的物の瑕疵について無償修補の責任を負うものとします。'),
        (6, '損害賠償', '甲乙いずれかの責に帰すべき事由により生じた損害は、その原因者が賠償するものとします。'),
        (7, '契約の解除', '相手方が契約に違反した場合、催告の上契約を解除することができるものとします。'),
        (8, '紛争の解決', '本契約に関する紛争は、甲乙協議により解決し、解決しない場合は管轄裁判所に委ねるものとします。'),
        (9, '守秘義務', '甲乙は、本工事に関して知り得た相手方の機密情報を第三者に漏洩してはならないものとします。')
        ON CONFLICT DO NOTHING
    """)

    # ─── QCDSテンプレートテーブル ────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS qcds_templates (
            id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name                        VARCHAR(100) NOT NULL,
            description                 TEXT,
            labor_insurance_rate        NUMERIC(8,6) NOT NULL DEFAULT 0.001973,
            construction_insurance_rate NUMERIC(8,6) NOT NULL DEFAULT 0.002095,
            special_insurance_rate      NUMERIC(8,6) NOT NULL DEFAULT 0.000110,
            office_supplies             NUMERIC(12,0) NOT NULL DEFAULT 2000,
            communication_cost          NUMERIC(12,0) NOT NULL DEFAULT 10000,
            misc_cost                   NUMERIC(12,0) NOT NULL DEFAULT 5000,
            site_staff_salary_rate      NUMERIC(6,4) NOT NULL DEFAULT 0.035,
            shared_overhead_rate        NUMERIC(6,4) NOT NULL DEFAULT 0.050,
            general_admin_rate          NUMERIC(6,4) NOT NULL DEFAULT 0.035,
            target_operating_profit_rate NUMERIC(6,4) NOT NULL DEFAULT 0.10,
            is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
            created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    # デフォルトテンプレート
    op.execute("""
        INSERT INTO qcds_templates (name, description) VALUES
        ('標準（一般工事）', 'クラップ標準の経費率。民間・元請・一般工事向け。')
        ON CONFLICT DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS qcds_templates")
    op.execute("DROP TABLE IF EXISTS contract_clauses")
    op.execute("ALTER TABLE company_settings DROP COLUMN IF EXISTS approval_route_config")
