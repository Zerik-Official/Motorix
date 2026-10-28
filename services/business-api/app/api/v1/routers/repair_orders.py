"""Endpoints of repair orders: create, consult, list, summarize by status and change status."""

# Standard library
from __future__ import annotations
from datetime import datetime
from typing import Annotated
from uuid import UUID

# Third-party
from fastapi import APIRouter, Depends, Query, status

# Project imports
from app.api.dependencies import (
    RepairOrderServiceDep,
    RepairOrdersReadDep,
    RepairOrdersWriteDep,
    get_settings_dependency,
)
from app.core.config import Settings
from app.core.errors import AppError
from app.models.repair_order import RepairOrderStatus
from app.repositories.repair_order import decode_cursor, encode_cursor
from app.schemas.common import CursorPage, ErrorResponse
from app.schemas.repair_order import (
    RepairOrderCreate,
    RepairOrderDetail,
    RepairOrderRead,
    RepairOrderStatusUpdate,
    RepairOrderSummary,
    StatusCount,
)

router: APIRouter = APIRouter(
    prefix="/repair-orders",
    tags=["repair-orders"],
    responses={
        status.HTTP_401_UNAUTHORIZED: {"model": ErrorResponse},
        status.HTTP_403_FORBIDDEN: {"model": ErrorResponse},
    },
)


def _decode_cursor_param(cursor: str | None) -> tuple[datetime, UUID] | None:
    """
    Decode the `cursor` query parameter.

    Args:
        cursor: Opaque cursor from the query string, or None for the first page.

    Returns:
        The decoded keyset position, or None for the first page.

    Raises:
        AppError: When the cursor is malformed.
    """
    if cursor is None:
        return None
    try:
        return decode_cursor(cursor)
    except ValueError as exc:
        raise AppError("The cursor is not valid") from exc


@router.post(
    "",
    response_model=RepairOrderDetail,
    status_code=status.HTTP_201_CREATED,
    responses={status.HTTP_404_NOT_FOUND: {"model": ErrorResponse}},
    summary="Register a new repair order",
)
async def create_repair_order(
    data: RepairOrderCreate,
    service: RepairOrderServiceDep,
    user: RepairOrdersWriteDep,
) -> RepairOrderDetail:
    """
    Register a new repair order for an existing engine.

    Args:
        data: Fields of the new order.
        service: Repair order service.
        user: Authenticated caller, whose identifier is stored as the creator.

    Returns:
        The persisted order, with its engine, client and initial history entry.
    """
    order = await service.create(data, created_by=user.id)
    return RepairOrderDetail.model_validate(order)


@router.get("", response_model=CursorPage[RepairOrderRead], summary="List repair orders")
async def list_repair_orders(
    service: RepairOrderServiceDep,
    _: RepairOrdersReadDep,
    settings: Annotated[Settings, Depends(get_settings_dependency)],
    limit: int = Query(default=20, ge=1, description="Maximum items per page"),
    cursor: str | None = Query(default=None, description="Opaque cursor returned by a previous page"),
    order_status: RepairOrderStatus | None = Query(default=None, alias="status", description="Filter by status"),
    client_id: UUID | None = Query(default=None, description="Keep only the orders of this client"),
    engine_id: UUID | None = Query(default=None, description="Keep only the orders of this engine"),
    search: str | None = Query(
        default=None,
        min_length=1,
        max_length=100,
        description="Match on the order number, reported issue, engine serial number or client name",
    ),
) -> CursorPage[RepairOrderRead]:
    """
    List repair orders with keyset pagination, newest first.

    Args:
        service: Repair order service.
        _: Authenticated caller.
        settings: Application settings, used to cap the page size.
        limit: Requested page size, reduced to `MAX_PAGE_SIZE` when larger.
        cursor: Opaque cursor returned by a previous page; omitted for the first page.
        order_status: Keep only orders with this status when set.
        client_id: Keep only the orders of this client when set.
        engine_id: Keep only the orders of this engine when set.
        search: Case insensitive match on the order number, reported issue, engine serial number or
            client name when set.

    Returns:
        The requested page, with the cursor of the next one when there may be more rows.
    """
    capped_limit: int = min(limit, settings.max_page_size)
    position = _decode_cursor_param(cursor)
    text: str | None = search.strip() or None if search is not None else None
    items = await service.list(capped_limit, position, order_status, client_id, engine_id, text)
    next_cursor: str | None = None
    if len(items) == capped_limit:
        last = items[-1]
        next_cursor = encode_cursor(last.created_at, last.id)
    read_items: list[RepairOrderRead] = [RepairOrderRead.model_validate(item) for item in items]
    return CursorPage(items=read_items, limit=capped_limit, next_cursor=next_cursor)


@router.get("/summary", response_model=RepairOrderSummary, summary="Count repair orders per status")
async def summarize_repair_orders(service: RepairOrderServiceDep, _: RepairOrdersReadDep) -> RepairOrderSummary:
    """
    Count the repair orders of every status with a single grouped query, for the dashboard.

    Args:
        service: Repair order service.
        _: Caller holding `repair_orders:read`.

    Returns:
        The total and the count of every status, including the statuses without orders.
    """
    counts: dict[RepairOrderStatus, int] = await service.summary()
    return RepairOrderSummary(
        total=sum(counts.values()),
        by_status=[StatusCount(status=order_status, count=count) for order_status, count in counts.items()],
    )


@router.get(
    "/{order_id}",
    response_model=RepairOrderDetail,
    responses={status.HTTP_404_NOT_FOUND: {"model": ErrorResponse}},
    summary="Fetch one repair order with its status history",
)
async def read_repair_order(
    order_id: UUID,
    service: RepairOrderServiceDep,
    _: RepairOrdersReadDep,
) -> RepairOrderDetail:
    """
    Fetch one repair order with its engine, client and full status history.

    Args:
        order_id: Identifier of the order.
        service: Repair order service.
        _: Authenticated caller.

    Returns:
        The order.
    """
    order = await service.get(order_id)
    return RepairOrderDetail.model_validate(order)


@router.patch(
    "/{order_id}/status",
    response_model=RepairOrderDetail,
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
    },
    summary="Move a repair order to a different status",
)
async def update_repair_order_status(
    order_id: UUID,
    data: RepairOrderStatusUpdate,
    service: RepairOrderServiceDep,
    user: RepairOrdersWriteDep,
) -> RepairOrderDetail:
    """
    Move a repair order to a different status and record the change in its history.

    Args:
        order_id: Identifier of the order.
        data: New status and an optional note.
        service: Repair order service.
        user: Authenticated caller, whose identifier is stored on the history entry.

    Returns:
        The updated order, with its refreshed status history.
    """
    order = await service.update_status(order_id, data, changed_by=user.id)
    return RepairOrderDetail.model_validate(order)
