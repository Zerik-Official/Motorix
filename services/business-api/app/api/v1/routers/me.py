"""Identity endpoint that shows the claims of a verified access token."""

# Standard library
from __future__ import annotations

# Third-party
from fastapi import APIRouter, status

# Project imports
from app.api.dependencies import CurrentUserDep
from app.core.security import CurrentUser
from app.schemas.common import ErrorResponse

router: APIRouter = APIRouter(prefix="/me", tags=["identity"])


@router.get(
    "",
    response_model=CurrentUser,
    responses={status.HTTP_401_UNAUTHORIZED: {"model": ErrorResponse}},
    summary="Return the identity of the caller",
)
async def read_me(user: CurrentUserDep) -> CurrentUser:
    """
    Return the identity carried by the access token, after verifying it.

    Args:
        user: Identity of the caller.

    Returns:
        The identifier, role and expiration of the token.
    """
    return user
