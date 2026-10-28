"""Engine model: the mining equipment owned by a client and serviced by the workshop."""

# Standard library
from __future__ import annotations
from datetime import datetime
from uuid import UUID

# Third-party
from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

# Project imports
from app.db.base import Base, UUIDPrimaryKeyMixin
from app.models.client import Client


class Engine(UUIDPrimaryKeyMixin, Base):
    """A client's engine, identified by its serial number."""

    __tablename__ = "engines"

    serial_number: Mapped[str] = mapped_column(String(100), unique=True)
    manufacturer: Mapped[str] = mapped_column(String(150))
    model: Mapped[str] = mapped_column(String(150))
    engine_type: Mapped[str] = mapped_column(String(150))
    power_rating: Mapped[str] = mapped_column(String(100))
    client_id: Mapped[UUID] = mapped_column(ForeignKey("clients.id"), index=True)
    registered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    client: Mapped[Client] = relationship()
