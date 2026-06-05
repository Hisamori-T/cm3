"""add special insurance equipment and demolition rates to qcds

Revision ID: y9z0a1b2c3d4
Revises: x8y9z0a1b2c3
Create Date: 2026-06-05
"""
from alembic import op
import sqlalchemy as sa

revision = "y9z0a1b2c3d4"
down_revision = "x8y9z0a1b2c3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "qcds",
        sa.Column(
            "special_insurance_equipment_rate",
            sa.Numeric(8, 6),
            nullable=False,
            server_default="0.000110",
        ),
    )
    op.add_column(
        "qcds",
        sa.Column(
            "special_insurance_demolition_rate",
            sa.Numeric(8, 6),
            nullable=False,
            server_default="0.019053",
        ),
    )


def downgrade() -> None:
    op.drop_column("qcds", "special_insurance_demolition_rate")
    op.drop_column("qcds", "special_insurance_equipment_rate")
