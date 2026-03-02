"""Add operating hours to resources

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "resources",
        sa.Column("operating_start_hour", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "resources",
        sa.Column("operating_end_hour", sa.Integer(), nullable=False, server_default="24"),
    )


def downgrade() -> None:
    op.drop_column("resources", "operating_end_hour")
    op.drop_column("resources", "operating_start_hour")
