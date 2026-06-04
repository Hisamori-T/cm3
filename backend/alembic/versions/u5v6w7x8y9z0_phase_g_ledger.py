"""Phase G: project_ledger_meta / ledger_approvals テーブル追加（工事台帳）。

Revision ID: u5v6w7x8y9z0
Revises: t4u5v6w7x8y9
Create Date: 2026-06-04

【設計メモ】
project_ledger_meta は projects テーブルに存在しないフィールドのみ保持する。
- original_client_name / prev_construction_year / prev_construction_other は projects に既存 → ledger_meta には含めない
- period_actual_start / period_actual_end は projects.period_actual_start/end として既存 → 同上
- prev_construction_self / target_profit_* / information_history / client_requirements → 新規追加のみ
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "u5v6w7x8y9z0"
down_revision = "t4u5v6w7x8y9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -----------------------------------------------------------------------
    # project_ledger_meta: 工事台帳の手動入力補完テーブル（案件1件につき1行）
    # projects に存在しないフィールドのみ追加
    # -----------------------------------------------------------------------
    op.create_table(
        "project_ledger_meta",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("information_history", sa.Text, nullable=True, comment="情報経緯"),
        sa.Column("client_requirements", sa.Text, nullable=True, comment="発注者要望事項"),
        sa.Column("prev_construction_self", sa.Boolean, nullable=True, comment="前施工: 当社フラグ"),
        sa.Column("target_profit_rate", sa.Numeric(5, 2), nullable=True, comment="目標営業利益率(%)"),
        sa.Column("target_profit_amount", sa.Numeric(12, 0), nullable=True, comment="目標営業利益額"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("ix_project_ledger_meta_project_id", "project_ledger_meta", ["project_id"])

    # -----------------------------------------------------------------------
    # ledger_approvals: 工事台帳承認枠（社長・建築部長・経理・担当）
    # -----------------------------------------------------------------------
    op.create_table(
        "ledger_approvals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role_label", sa.String(30), nullable=False, comment="社長|建築部長|経理|担当"),
        sa.Column("approver_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("comment", sa.Text, nullable=True),
        sa.Column("display_order", sa.SmallInteger, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ledger_approvals_project_id", "ledger_approvals", ["project_id"])
    op.create_unique_constraint("uq_ledger_approvals_project_role", "ledger_approvals", ["project_id", "role_label"])

    # 既存案件全件に4枠分の初期レコードを挿入
    op.execute("""
        INSERT INTO ledger_approvals (project_id, role_label, display_order)
        SELECT p.id, r.role_label, r.disp_order
        FROM projects p
        CROSS JOIN (VALUES
            ('社長',     0),
            ('建築部長', 1),
            ('経理',     2),
            ('担当',     3)
        ) AS r(role_label, disp_order)
        WHERE p.deleted_at IS NULL
        ON CONFLICT DO NOTHING
    """)


def downgrade() -> None:
    op.drop_index("ix_ledger_approvals_project_id", table_name="ledger_approvals")
    op.drop_constraint("uq_ledger_approvals_project_role", "ledger_approvals", type_="unique")
    op.drop_table("ledger_approvals")
    op.drop_index("ix_project_ledger_meta_project_id", table_name="project_ledger_meta")
    op.drop_table("project_ledger_meta")
