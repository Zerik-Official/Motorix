"""Schemas of the client endpoints."""

# Standard library
from __future__ import annotations
from datetime import datetime
from uuid import UUID

# Third-party
from pydantic import BaseModel, ConfigDict, EmailStr, Field

# Project imports
from app.models.client import IdentificationType


class ClientBase(BaseModel):
    """Fields a client is created or fully replaced with."""

    name: str = Field(min_length=1, max_length=200)
    identification_type: IdentificationType
    identification_number: str = Field(min_length=1, max_length=50)
    email: EmailStr


class ClientCreate(ClientBase):
    """Body of `POST /clients`."""


class ClientUpdate(ClientBase):
    """Body of `PUT /clients/{id}`."""

    is_active: bool | None = Field(
        default=None,
        description="Set to true to reactivate or false to deactivate; omitted keeps the current state",
    )


class ClientRead(ClientBase):
    """Representation of a client returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
