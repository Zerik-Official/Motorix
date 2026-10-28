"""Declarative base and column mixins shared by every model."""

# Standard library
from __future__ import annotations
from datetime import datetime, timezone
from uuid import UUID, uuid4

# Third-party
from sqlalchemy import DateTime, MetaData, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

NAMING_CONVENTION: dict[str, str] = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}
"""Deterministic constraint names, so Alembic migrations are reproducible."""


class Base(DeclarativeBase):
    """Base class of every model."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class UUIDPrimaryKeyMixin:
    """Random UUID primary key."""

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)


def utc_now() -> datetime:
    """
    Return the current time, timezone aware and with full microsecond precision.

    Returns:
        The current UTC time.

    A column that only had `server_default=func.now()` would be timestamped by the
    database, which on SQLite drops the microseconds; a value compared against that
    column later (such as a keyset pagination cursor) would then never match by equality.
    Setting this as the Python-side default keeps one precise, consistent value for both
    the insert and any later comparison, on every backend.
    """
    return datetime.now(timezone.utc)


class TimestampMixin:
    """Creation and last update timestamps managed by the database."""

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        server_default=func.now(),
    )
