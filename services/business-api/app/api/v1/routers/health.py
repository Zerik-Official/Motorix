"""Health check endpoint used by Docker, load balancers and CI."""

# Standard library
from __future__ import annotations
from typing import Annotated

# Third-party
from fastapi import APIRouter, Depends, Response, status

# Project imports
from app.api.dependencies import get_database
from app.db.session import Database
from app.schemas.system import ComponentStatus, HealthResponse
from app.services.health import HealthService

router: APIRouter = APIRouter(tags=["health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    responses={status.HTTP_503_SERVICE_UNAVAILABLE: {"model": HealthResponse}},
    summary="Check the service and its database",
)
async def health(response: Response, database: Annotated[Database, Depends(get_database)]) -> HealthResponse:
    """
    Report whether the service can serve requests.

    Args:
        response: Outgoing response, whose status becomes 503 when a dependency is down.
        database: Application database.

    Returns:
        The state of the service and its database.
    """
    result: HealthResponse = await HealthService(database).check()
    if result.status is not ComponentStatus.OK:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return result
