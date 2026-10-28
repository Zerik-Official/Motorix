"""Repair order model: the service ticket of an engine, with its status history."""

# Standard library
from __future__ import annotations
from datetime import date, datetime
from enum import StrEnum
from uuid import UUID

# Third-party
from sqlalchemy import Date, DateTime, Enum, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

# Project imports
from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, utc_now
from app.models.client import Client
from app.models.engine import Engine


class RepairOrderStatus(StrEnum):
    """Stage of a repair order, in the order the workshop usually moves through them."""

    RECEIVED = "received"
    IN_DIAGNOSIS = "in_diagnosis"
    AWAITING_APPROVAL = "awaiting_approval"
    IN_REPAIR = "in_repair"
    IN_TESTING = "in_testing"
    FINISHED = "finished"
    DELIVERED = "delivered"


def _status_enum(name: str) -> Enum:
    """
    Build a `RepairOrderStatus` column type that stores the enum value, not its Python name.

    Args:
        name: Name of the Postgres enum type.

    Returns:
        The configured column type.
    """
    return Enum(RepairOrderStatus, name=name, values_callable=lambda enum: [member.value for member in enum])


class RepairOrder(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A service ticket tracking one engine's repair, from reception to delivery."""

    __tablename__ = "repair_orders"
    __table_args__ = (Index("ix_repair_orders_created_at_id", "created_at", "id"),)

    order_number: Mapped[str] = mapped_column(String(30), unique=True)
    engine_id: Mapped[UUID] = mapped_column(ForeignKey("engines.id"), index=True)
    client_id: Mapped[UUID] = mapped_column(ForeignKey("clients.id"), index=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, server_default=func.now())
    reported_issue: Mapped[str] = mapped_column(Text)
    diagnosis: Mapped[str | None] = mapped_column(Text, default=None)
    work_performed: Mapped[str | None] = mapped_column(Text, default=None)
    technician_name: Mapped[str | None] = mapped_column(String(150), default=None)
    estimated_delivery_date: Mapped[date | None] = mapped_column(Date, default=None)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    status: Mapped[RepairOrderStatus] = mapped_column(
        _status_enum("repair_order_status"),
        default=RepairOrderStatus.RECEIVED,
        server_default=RepairOrderStatus.RECEIVED.value,
        index=True,
    )
    observations: Mapped[str | None] = mapped_column(Text, default=None)
    created_by: Mapped[UUID] = mapped_column()

    engine: Mapped[Engine] = relationship()
    client: Mapped[Client] = relationship()
    history: Mapped[list["RepairOrderStatusHistory"]] = relationship(
        back_populates="repair_order",
        order_by="RepairOrderStatusHistory.changed_at",
    )


class RepairOrderStatusHistory(UUIDPrimaryKeyMixin, Base):
    """One status transition of a repair order."""

    __tablename__ = "repair_order_status_history"
    __table_args__ = (
        Index(
            "ix_repair_order_status_history_repair_order_id_changed_at",
            "repair_order_id",
            "changed_at",
        ),
    )

    repair_order_id: Mapped[UUID] = mapped_column(ForeignKey("repair_orders.id"))
    from_status: Mapped[RepairOrderStatus | None] = mapped_column(
        _status_enum("repair_order_status"),
        default=None,
    )
    to_status: Mapped[RepairOrderStatus] = mapped_column(_status_enum("repair_order_status"))
    note: Mapped[str | None] = mapped_column(Text, default=None)
    changed_by: Mapped[UUID] = mapped_column()
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, server_default=func.now())

    repair_order: Mapped[RepairOrder] = relationship(back_populates="history")
