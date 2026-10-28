"""create clients table

Revision ID: b1595cfea5ec
Revises:
Create Date: 2026-10-27 23:33:01.434731
"""

# Standard library
from __future__ import annotations
from collections.abc import Sequence

# Third-party
import sqlalchemy as sa
from alembic import op

revision: str = "b1595cfea5ec"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Apply the migration."""
    op.create_table(
        "clients",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column(
            "identification_type",
            sa.Enum("cc", "nit", "ce", "passport", name="identification_type"),
            nullable=False,
        ),
        sa.Column("identification_number", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_clients")),
        sa.UniqueConstraint("identification_type", "identification_number", name="uq_clients_identification"),
    )


def downgrade() -> None:
    """Revert the migration."""
    op.drop_table("clients")
    sa.Enum(name="identification_type").drop(op.get_bind(), checkfirst=True)
