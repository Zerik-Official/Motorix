"""Schemas of the repair order endpoints."""

# Standard library
from __future__ import annotations
from datetime import date, datetime
from uuid import UUID

# Third-party
from pydantic import BaseModel, ConfigDict, Field

# Project imports
from app.models.repair_order import RepairOrderStatus


class EngineSummary(BaseModel):
    """The engine fields a repair order shows without a second request."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    serial_number: str
    manufacturer: str
    model: str


class ClientSummary(BaseModel):
    """The client fields a repair order shows without a second request."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    identification_number: str


class RepairOrderCreate(BaseModel):
    """Body of `POST /repair-orders`."""

    engine_id: UUID
    reported_issue: str = Field(min_length=1)
    diagnosis: str | None = None
    work_performed: str | None = None
    technician_name: str | None = Field(default=None, max_length=150)
    estimated_delivery_date: date | None = None
    observations: str | None = None


class RepairOrderStatusUpdate(BaseModel):
    """Body of `PATCH /repair-orders/{id}/status`."""

    status: RepairOrderStatus
    note: str | None = None


class RepairOrderRead(BaseModel):
    """Representation of a repair order returned by the API, without its history."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_number: str
    engine: EngineSummary
    client: ClientSummary
    received_at: datetime
    reported_issue: str
    diagnosis: str | None
    work_performed: str | None
    technician_name: str | None
    estimated_delivery_date: date | None
    delivered_at: datetime | None
    status: RepairOrderStatus
    observations: str | None
    created_by: UUID
    created_at: datetime
    updated_at: datetime


class RepairOrderStatusHistoryRead(BaseModel):
    """One entry of a repair order's status history."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    from_status: RepairOrderStatus | None
    to_status: RepairOrderStatus
    note: str | None
    changed_by: UUID
    changed_at: datetime


class RepairOrderDetail(RepairOrderRead):
    """A repair order with its full status history, oldest first."""

    history: list[RepairOrderStatusHistoryRead]
