"""Schemas of the health check endpoint."""

# Standard library
from __future__ import annotations
from enum import StrEnum

# Third-party
from pydantic import BaseModel


class ComponentStatus(StrEnum):
    """State of the service or one of its dependencies."""

    OK = "ok"
    UNAVAILABLE = "unavailable"


class HealthResponse(BaseModel):
    """Result of the health check."""

    status: ComponentStatus
    database: ComponentStatus
