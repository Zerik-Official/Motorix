"""CRUD endpoints of clients."""

# Standard library
from __future__ import annotations
from uuid import UUID

# Third-party
from fastapi import APIRouter, Query, status

# Project imports
from app.api.dependencies import ClientServiceDep, CurrentUserDep, PageParamsDep
from app.schemas.client import ClientCreate, ClientRead, ClientUpdate
from app.schemas.common import ErrorResponse, Page

router: APIRouter = APIRouter(prefix="/clients", tags=["clients"])


@router.post(
    "",
    response_model=ClientRead,
    status_code=status.HTTP_201_CREATED,
    responses={status.HTTP_409_CONFLICT: {"model": ErrorResponse}},
    summary="Register a new client",
)
async def create_client(data: ClientCreate, service: ClientServiceDep, _: CurrentUserDep) -> ClientRead:
    """
    Register a new client.

    Args:
        data: Fields of the new client.
        service: Client service.
        _: Authenticated caller.

    Returns:
        The persisted client.
    """
    client = await service.create(data)
    return ClientRead.model_validate(client)


@router.get("", response_model=Page[ClientRead], summary="List clients")
async def list_clients(
    service: ClientServiceDep,
    _: CurrentUserDep,
    page: PageParamsDep,
    search: str | None = Query(default=None, description="Match on the name or the identification number"),
    is_active: bool | None = Query(default=None, description="Keep only active or only inactive clients"),
) -> Page[ClientRead]:
    """
    List clients with pagination, an optional search and an optional active filter.

    Args:
        service: Client service.
        _: Authenticated caller.
        page: Pagination parameters.
        search: Case insensitive match on the name or the identification number.
        is_active: Keep only active or only inactive clients when set.

    Returns:
        The requested page.
    """
    items, total = await service.list(page.offset, page.limit, search, is_active)
    read_items: list[ClientRead] = [ClientRead.model_validate(item) for item in items]
    return Page(items=read_items, total=total, limit=page.limit, offset=page.offset)


@router.get(
    "/{client_id}",
    response_model=ClientRead,
    responses={status.HTTP_404_NOT_FOUND: {"model": ErrorResponse}},
    summary="Fetch one client",
)
async def read_client(client_id: UUID, service: ClientServiceDep, _: CurrentUserDep) -> ClientRead:
    """
    Fetch one client.

    Args:
        client_id: Identifier of the client.
        service: Client service.
        _: Authenticated caller.

    Returns:
        The client.
    """
    client = await service.get(client_id)
    return ClientRead.model_validate(client)


@router.put(
    "/{client_id}",
    response_model=ClientRead,
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ErrorResponse},
        status.HTTP_409_CONFLICT: {"model": ErrorResponse},
    },
    summary="Replace the editable fields of a client",
)
async def update_client(
    client_id: UUID,
    data: ClientUpdate,
    service: ClientServiceDep,
    _: CurrentUserDep,
) -> ClientRead:
    """
    Replace the editable fields of a client.

    Args:
        client_id: Identifier of the client.
        data: New values of every editable field.
        service: Client service.
        _: Authenticated caller.

    Returns:
        The updated client.
    """
    client = await service.update(client_id, data)
    return ClientRead.model_validate(client)


@router.delete(
    "/{client_id}",
    response_model=ClientRead,
    responses={status.HTTP_404_NOT_FOUND: {"model": ErrorResponse}},
    summary="Deactivate a client",
)
async def deactivate_client(client_id: UUID, service: ClientServiceDep, _: CurrentUserDep) -> ClientRead:
    """
    Deactivate a client without deleting its row, so its history is preserved.

    Args:
        client_id: Identifier of the client.
        service: Client service.
        _: Authenticated caller.

    Returns:
        The deactivated client.
    """
    client = await service.deactivate(client_id)
    return ClientRead.model_validate(client)
