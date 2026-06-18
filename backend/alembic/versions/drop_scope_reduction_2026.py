"""スコープ縮小: QCDS/工事台帳承認/注文書/注文請書/請求書/進捗/出面/発注 関連テーブルを削除。

業者見積・顧客見積・編集履歴のみを残すスコープ縮小に伴い、対象外の
テーブルおよび専用ENUM型を削除する。プロダクションDBはテストデータのみで
運用データなし（ひささん確認済み）。

Revision ID: drop_scope_reduction_2026
Revises: R1_invoice_role_phase_deductions, b8c2d4e6f8a1
Create Date: 2026-06-16
"""
from __future__ import annotations

from alembic import op

revision = "drop_scope_reduction_2026"
down_revision = ("R1_invoice_role_phase_deductions", "b8c2d4e6f8a1")
branch_labels = None
depends_on = None

_TABLES = [
    "qcds_direct_works",
    "qcds_expense_items",
    "qcds",
    "ledger_approvals",
    "project_ledger_meta",
    "acknowledgments",
    "orders",
    "invoice_deductions",
    "invoice_items",
    "payments",
    "invoices",
    "progress_attachments",
    "progress_logs",
    "vendor_attendances",
    "purchase_order_items",
    "vendor_deliveries",
    "purchase_orders",
]

_ENUM_TYPES = [
    "qcdscategory",
    "orderstatus",
    "invoicestatus",
    "billingmethod",
    "invoicephase",
    "deductiontype",
    "acknowledgmentstatus",
    "progresslogtype",
    "canonsyncstatus",
    "purchaseorderstatus",
    "deliverystatus",
]


def upgrade() -> None:
    for table in _TABLES:
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
    for enum_type in _ENUM_TYPES:
        op.execute(f"DROP TYPE IF EXISTS {enum_type}")


def downgrade() -> None:
    raise NotImplementedError(
        "このマイグレーションは破壊的削除のため downgrade 不可。"
        "復元が必要な場合は parts リポジトリのバックアップを参照すること。"
    )
