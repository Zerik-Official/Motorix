"""CRUD endpoints of engines."""

# Standard library
from __future__ import annotations
from uuid import UUID

# Third-party
from fastapi import APIRouter, Query, status

# Project imports
from app.api.dependencies import EngineServiceDep, EnginesReadDep, EnginesWriteDep, PageParamsDep
from app.schemas.common import ErrorResponse, Page
from app.schemas.engine import EngineCreate, EngineRead, EngineUpdate

router: APIRouter = APIRouter(
    prefix="/engines",
    tags=["engines"],
    responses={
        status.HTTP_401_UNAUTHORIZED: {"model": ErrorResponse},
        status.HTTP_403_FORBIDDEN: {"model": ErrorResponse},
    },
)


@router.post(
    "",
    response_model=EngineRead,
    status_code=status.HTTP_201_CREATED,
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ErrorResponse},
        status.HTTP_409_CONFLICT: {"model": ErrorResponse},
    },
    summary="Register a new engine",
)
async def create_engine(data: EngineCreate, service: EngineServiceDep, _: EnginesWriteDep) -> EngineRead:
    """
    Register a new engine.

    Args:
        data: Fields of the new engine.
        service: Engine service.
        _: Authenticated caller.

    Returns:
        The persisted engine.
    """
    engine = await service.create(data)
    return EngineRead.model_validate(engine)


@router.get("", response_model=Page[EngineRead], summary="List engines")
async def list_engines(
    service: EngineServiceDep,
    _: EnginesReadDep,
    page: PageParamsDep,
    search: str | None = Query(default=None, description="Match on the serial number, manufacturer or model"),
    client_id: UUID | None = Query(default=None, description="Keep only the engines of this client"),
    is_active: bool | None = Query(default=None, description="Keep only active or only inactive engines"),
) -> Page[EngineRead]:
    """
    List engines with pagination, an optional search, owner and active filter.

    Args:
        service: Engine service.
        _: Authenticated caller.
        page: Pagination parameters.
        search: Case insensitive match on the serial number, manufacturer or model.
        client_id: Keep only the engines of this client when set.
        is_active: Keep only active or only inactive engines when set.

    Returns:
        The requested page.
    """
    items, total = await service.list(page.offset, page.limit, search, client_id, is_active)
    read_items: list[EngineRead] = [EngineRead.model_validate(item) for item in items]
    return Page(items=read_items, total=total, limit=page.limit, offset=page.offset)


@router.get(
    "/{engine_id}",
    response_model=EngineRead,
    responses={status.HTTP_404_NOT_FOUND: {"model": ErrorResponse}},
    summary="Fetch one engine",
)
async def read_engine(engine_id: UUID, service: EngineServiceDep, _: EnginesReadDep) -> EngineRead:
    """
    Fetch one engine.

    Args:
        engine_id: Identifier of the engine.
        service: Engine service.
        _: Authenticated caller.

    Returns:
        The engine.
    """
    engine = await service.get(engine_id)
    return EngineRead.model_validate(engine)


@router.put(
    "/{engine_id}",
    response_model=EngineRead,
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ErrorResponse},
        status.HTTP_409_CONFLICT: {"model": ErrorResponse},
    },
    summary="Replace the editable fields of an engine",
)
async def update_engine(
    engine_id: UUID,
    data: EngineUpdate,
    service: EngineServiceDep,
    _: EnginesWriteDep,
) -> EngineRead:
    """
    Replace the editable fields of an engine.

    Args:
        engine_id: Identifier of the engine.
        data: New values of every editable field.
        service: Engine service.
        _: Authenticated caller.

    Returns:
        The updated engine.
    """
    engine = await service.update(engine_id, data)
    return EngineRead.model_validate(engine)


@router.delete(
    "/{engine_id}",
    response_model=EngineRead,
    responses={status.HTTP_404_NOT_FOUND: {"model": ErrorResponse}},
    summary="Deactivate an engine",
)
async def deactivate_engine(engine_id: UUID, service: EngineServiceDep, _: EnginesWriteDep) -> EngineRead:
    """
    Deactivate an engine without deleting its row, so its repair history is preserved.

    Args:
        engine_id: Identifier of the engine.
        service: Engine service.
        _: Authenticated caller.

    Returns:
        The deactivated engine.
    """
    engine = await service.deactivate(engine_id)
    return EngineRead.model_validate(engine)
