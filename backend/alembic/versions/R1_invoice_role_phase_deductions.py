"""Phase R-1: project_role / invoice_phase / deduction_type enums + invoice columns + invoice_deductions table."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "R1_invoice_role_phase_deductions"
down_revision = "merge_heads_2026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Enum 型を作成 ──────────────────────────────────────────────────────
    # PostgreSQL の ALTER TYPE ... ADD VALUE は DDL なのでトランザクション外で実行
    op.execute("COMMIT")

    op.execute("CREATE TYPE projectrole AS ENUM ('prime', 'sub', 'public')")
    op.execute("CREATE TYPE invoicephase AS ENUM ('advance', 'interim', 'partial', 'final', 'none')")
    op.execute("CREATE TYPE deductiontype AS ENUM ('safety_fee', 'materials_advance', 'parking_fee', 'statutory_welfare', 'other')")

    op.execute("BEGIN")

    # ── 2. projects.project_role カラム追加 ────────────────────────────────────
    op.add_column(
        "projects",
        sa.Column("project_role", postgresql.ENUM("prime", "sub", "public", name="projectrole", create_type=False), nullable=True),
    )

    # ── 3. invoices に 5 カラム追加 ────────────────────────────────────────────
    op.add_column("invoices", sa.Column("invoice_phase", postgresql.ENUM("advance", "interim", "partial", "final", "none", name="invoicephase", create_type=False), nullable=False, server_default="none"))
    op.add_column("invoices", sa.Column("project_role_snapshot", sa.String(20), nullable=True))
    op.add_column("invoices", sa.Column("contract_amount_snapshot", sa.Numeric(12, 0), nullable=True))
    op.add_column("invoices", sa.Column("total_deduction_amount", sa.Numeric(12, 0), nullable=False, server_default="0"))
    op.add_column("invoices", sa.Column("final_payable_amount", sa.Numeric(12, 0), nullable=False, server_default="0"))

    # ── 4. invoice_deductions テーブル作成 ────────────────────────────────────
    op.create_table(
        "invoice_deductions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("deduction_type", postgresql.ENUM("safety_fee", "materials_advance", "parking_fee", "statutory_welfare", "other", name="deductiontype", create_type=False), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("amount", sa.Numeric(12, 0), nullable=False),
        sa.Column("calculation_rate", sa.Numeric(8, 4), nullable=True),
        sa.Column("account_hint", sa.String(50), nullable=True),
        sa.Column("is_deleted", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("row_no", sa.Integer, nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_invoice_deductions_invoice_id", "invoice_deductions", ["invoice_id"])


def downgrade() -> None:
    op.drop_table("invoice_deductions")
    op.drop_column("invoices", "final_payable_amount")
    op.drop_column("invoices", "total_deduction_amount")
    op.drop_column("invoices", "contract_amount_snapshot")
    op.drop_column("invoices", "project_role_snapshot")
    op.drop_column("invoices", "invoice_phase")
    op.drop_column("projects", "project_role")
    op.execute("COMMIT")
    op.execute("DROP TYPE IF EXISTS deductiontype")
    op.execute("DROP TYPE IF EXISTS invoicephase")
    op.execute("DROP TYPE IF EXISTS projectrole")
    op.execute("BEGIN")
