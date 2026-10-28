"""create repair orders and status history tables

Revision ID: 0c57c09130a8
Revises: e574132efaac
Create Date: 2026-10-28 00:34:00.249363
"""

# Standard library
from __future__ import annotations
from collections.abc import Sequence

# Third-party
import sqlalchemy as sa
from alembic import op

revision: str = "0c57c09130a8"
down_revision: str | None = "e574132efaac"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_STATUS_VALUES: tuple[str, ...] = (
    "received",
    "in_diagnosis",
    "awaiting_approval",
    "in_repair",
    "in_testing",
    "finished",
    "delivered",
)


def upgrade() -> None:
    """Apply the migration."""
    op.create_table(
        "repair_orders",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("order_number", sa.String(length=30), nullable=False),
        sa.Column("engine_id", sa.Uuid(), nullable=False),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("reported_issue", sa.Text(), nullable=False),
        sa.Column("diagnosis", sa.Text(), nullable=True),
        sa.Column("work_performed", sa.Text(), nullable=True),
        sa.Column("technician_name", sa.String(length=150), nullable=True),
        sa.Column("estimated_delivery_date", sa.Date(), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "status",
            sa.Enum(*_STATUS_VALUES, name="repair_order_status"),
            server_default="received",
            nullable=False,
        ),
        sa.Column("observations", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], name=op.f("fk_repair_orders_client_id_clients")),
        sa.ForeignKeyConstraint(["engine_id"], ["engines.id"], name=op.f("fk_repair_orders_engine_id_engines")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_repair_orders")),
        sa.UniqueConstraint("order_number", name=op.f("uq_repair_orders_order_number")),
    )
    op.create_index(op.f("ix_repair_orders_client_id"), "repair_orders", ["client_id"], unique=False)
    op.create_index("ix_repair_orders_created_at_id", "repair_orders", ["created_at", "id"], unique=False)
    op.create_index(op.f("ix_repair_orders_engine_id"), "repair_orders", ["engine_id"], unique=False)
    op.create_index(op.f("ix_repair_orders_status"), "repair_orders", ["status"], unique=False)

    op.create_table(
        "repair_order_status_history",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("repair_order_id", sa.Uuid(), nullable=False),
        sa.Column("from_status", sa.Enum(*_STATUS_VALUES, name="repair_order_status"), nullable=True),
        sa.Column("to_status", sa.Enum(*_STATUS_VALUES, name="repair_order_status"), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("changed_by", sa.Uuid(), nullable=False),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["repair_order_id"],
            ["repair_orders.id"],
            name=op.f("fk_repair_order_status_history_repair_order_id_repair_orders"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_repair_order_status_history")),
    )
    op.create_index(
        "ix_repair_order_status_history_repair_order_id_changed_at",
        "repair_order_status_history",
        ["repair_order_id", "changed_at"],
        unique=False,
    )


def downgrade() -> None:
    """Revert the migration."""
    op.drop_index(
        "ix_repair_order_status_history_repair_order_id_changed_at",
        table_name="repair_order_status_history",
    )
    op.drop_table("repair_order_status_history")
    op.drop_index(op.f("ix_repair_orders_status"), table_name="repair_orders")
    op.drop_index(op.f("ix_repair_orders_engine_id"), table_name="repair_orders")
    op.drop_index("ix_repair_orders_created_at_id", table_name="repair_orders")
    op.drop_index(op.f("ix_repair_orders_client_id"), table_name="repair_orders")
    op.drop_table("repair_orders")
    sa.Enum(name="repair_order_status").drop(op.get_bind(), checkfirst=True)
