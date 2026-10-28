"""Schemas of the engine endpoints."""

# Standard library
from __future__ import annotations
from datetime import datetime
from uuid import UUID

# Third-party
from pydantic import BaseModel, ConfigDict, Field

# Project imports
from app.models.client import IdentificationType


class EngineOwner(BaseModel):
    """The owner fields an engine shows without a second request."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    identification_type: IdentificationType
    identification_number: str
    is_active: bool


class EngineBase(BaseModel):
    """Fields an engine is created or fully replaced with."""

    serial_number: str = Field(min_length=1, max_length=100)
    manufacturer: str = Field(min_length=1, max_length=150)
    model: str = Field(min_length=1, max_length=150)
    engine_type: str = Field(min_length=1, max_length=150)
    power_rating: str = Field(min_length=1, max_length=100)
    client_id: UUID


class EngineCreate(EngineBase):
    """Body of `POST /engines`."""


class EngineUpdate(EngineBase):
    """Body of `PUT /engines/{id}`."""

    is_active: bool | None = Field(
        default=None,
        description="Set to true to reactivate or false to deactivate; omitted keeps the current state",
    )


class EngineRead(EngineBase):
    """Representation of an engine returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    is_active: bool
    registered_at: datetime
    updated_at: datetime
    client: EngineOwner
