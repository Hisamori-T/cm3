"""顧客マスタテーブル追加 (clients, client_sites, client_contacts) + projects FK列追加

Revision ID: a1b2c3d4e5f6
Revises: f1e9c8b7a6d5
Create Date: 2026-05-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "a1b2c3d4e5f6"
down_revision = "f1e9c8b7a6d5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # clientrank enum
    op.execute("CREATE TYPE clientrank AS ENUM ('A', 'B', 'C')")

    # clients テーブル
    op.create_table(
        "clients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("client_code", sa.String(50), nullable=True, unique=True),
        sa.Column("client_name", sa.String(255), nullable=False),
        sa.Column("client_name_kana", sa.String(255), nullable=True),
        sa.Column("postal_code", sa.String(10), nullable=True),
        sa.Column("address", sa.Text, nullable=True),
        sa.Column("phone", sa.String(30), nullable=True),
        sa.Column("fax", sa.String(30), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("representative", sa.String(100), nullable=True),
        sa.Column(
            "client_rank",
            postgresql.ENUM("A", "B", "C", name="clientrank", create_type=False),
            nullable=True,
        ),
        sa.Column("payment_condition_default", sa.Text, nullable=True),
        sa.Column("credit_limit", sa.Numeric(14, 0), nullable=True),
        sa.Column("tax_id", sa.String(20), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_clients_client_name", "clients", ["client_name"])

    # client_sites テーブル
    op.create_table(
        "client_sites",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "client_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clients.id"),
            nullable=False,
        ),
        sa.Column("site_code", sa.String(50), nullable=True),
        sa.Column("site_name", sa.String(255), nullable=False),
        sa.Column("region", sa.String(50), nullable=True),
        sa.Column("postal_code", sa.String(10), nullable=True),
        sa.Column("address", sa.Text, nullable=True),
        sa.Column("site_manager", sa.String(100), nullable=True),
        sa.Column("site_phone", sa.String(30), nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_client_sites_client_id", "client_sites", ["client_id"])
    op.create_index("ix_client_sites_site_name", "client_sites", ["site_name"])

    # client_contacts テーブル
    op.create_table(
        "client_contacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "client_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clients.id"),
            nullable=False,
        ),
        sa.Column(
            "client_site_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("client_sites.id"),
            nullable=True,
        ),
        sa.Column("department", sa.String(100), nullable=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("name_kana", sa.String(100), nullable=True),
        sa.Column("title", sa.String(100), nullable=True),
        sa.Column("phone", sa.String(30), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("is_primary", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_client_contacts_client_id", "client_contacts", ["client_id"])

    # projects テーブルに顧客FK列追加
    op.add_column(
        "projects",
        sa.Column(
            "client_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clients.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "projects",
        sa.Column(
            "client_site_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("client_sites.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "projects",
        sa.Column(
            "client_contact_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("client_contacts.id"),
            nullable=True,
        ),
    )
    op.create_index("ix_projects_client_id", "projects", ["client_id"])


def downgrade() -> None:
    op.drop_index("ix_projects_client_id", "projects")
    op.drop_column("projects", "client_contact_id")
    op.drop_column("projects", "client_site_id")
    op.drop_column("projects", "client_id")
    op.drop_index("ix_client_contacts_client_id", "client_contacts")
    op.drop_table("client_contacts")
    op.drop_index("ix_client_sites_site_name", "client_sites")
    op.drop_index("ix_client_sites_client_id", "client_sites")
    op.drop_table("client_sites")
    op.drop_index("ix_clients_client_name", "clients")
    op.drop_table("clients")
    op.execute("DROP TYPE clientrank")
