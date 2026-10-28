"""create engines table

Revision ID: e574132efaac
Revises: b1595cfea5ec
Create Date: 2026-10-27 23:56:07.096994
"""

# Standard library
from __future__ import annotations
from collections.abc import Sequence

# Third-party
import sqlalchemy as sa
from alembic import op

revision: str = "e574132efaac"
down_revision: str | None = "b1595cfea5ec"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Apply the migration."""
    op.create_table(
        "engines",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("serial_number", sa.String(length=100), nullable=False),
        sa.Column("manufacturer", sa.String(length=150), nullable=False),
        sa.Column("model", sa.String(length=150), nullable=False),
        sa.Column("engine_type", sa.String(length=150), nullable=False),
        sa.Column("power_rating", sa.String(length=100), nullable=False),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("registered_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], name=op.f("fk_engines_client_id_clients")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_engines")),
        sa.UniqueConstraint("serial_number", name=op.f("uq_engines_serial_number")),
    )
    op.create_index(op.f("ix_engines_client_id"), "engines", ["client_id"], unique=False)


def downgrade() -> None:
    """Revert the migration."""
    op.drop_index(op.f("ix_engines_client_id"), table_name="engines")
    op.drop_table("engines")
