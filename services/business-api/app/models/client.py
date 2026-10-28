"""Client model: the person or company that owns engines and requests repairs."""

# Standard library
from __future__ import annotations
from enum import StrEnum

# Third-party
from sqlalchemy import Boolean, Enum, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

# Project imports
from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class IdentificationType(StrEnum):
    """Kind of identification document a client is registered with."""

    CC = "cc"
    NIT = "nit"
    CE = "ce"
    PASSPORT = "passport"


class Client(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A person or company whose engines are serviced by the workshop."""

    __tablename__ = "clients"
    __table_args__ = (
        UniqueConstraint("identification_type", "identification_number", name="uq_clients_identification"),
    )

    name: Mapped[str] = mapped_column(String(200))
    identification_type: Mapped[IdentificationType] = mapped_column(
        Enum(
            IdentificationType,
            name="identification_type",
            values_callable=lambda enum: [member.value for member in enum],
        ),
    )
    identification_number: Mapped[str] = mapped_column(String(50))
    email: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
