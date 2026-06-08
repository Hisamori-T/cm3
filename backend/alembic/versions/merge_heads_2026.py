"""merge invoice split chain and quote approved status."""
from alembic import op

revision = "merge_heads_2026"
down_revision = ("inv_completion_date", "quote_approved_2026")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
