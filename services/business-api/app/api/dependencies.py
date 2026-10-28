"""Dependencies injected into the routers: database session, settings and the authenticated user."""

# Standard library
from __future__ import annotations
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Annotated

# Third-party
from fastapi import Depends, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

# Project imports
from app.core.config import Settings
from app.core.errors import AuthenticationError, PermissionDeniedError
from app.core.security import CurrentUser, JwtVerifier, Permission
from app.db.session import Database
from app.repositories.client import ClientRepository
from app.repositories.engine import EngineRepository
from app.repositories.repair_order import RepairOrderRepository
from app.services.client import ClientService
from app.services.engine import EngineService
from app.services.repair_order import RepairOrderService

bearer_scheme: HTTPBearer = HTTPBearer(auto_error=False, description="Access token issued by auth-api")


def get_settings_dependency(request: Request) -> Settings:
    """
    Return the settings the application was created with.

    Args:
        request: Incoming request.

    Returns:
        The application settings.
    """
    settings: Settings = request.app.state.settings
    return settings


def get_database(request: Request) -> Database:
    """
    Return the database of the application.

    Args:
        request: Incoming request.

    Returns:
        The application database.
    """
    database: Database = request.app.state.database
    return database


def get_jwt_verifier(request: Request) -> JwtVerifier:
    """
    Return the token verifier of the application.

    Args:
        request: Incoming request.

    Returns:
        The application token verifier.
    """
    verifier: JwtVerifier = request.app.state.jwt_verifier
    return verifier


async def get_session(database: Annotated[Database, Depends(get_database)]) -> AsyncIterator[AsyncSession]:
    """
    Open a session for the request, committed when the request succeeds.

    Args:
        database: Application database.

    Yields:
        The session of the request.
    """
    async for session in database.session():
        yield session


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    verifier: Annotated[JwtVerifier, Depends(get_jwt_verifier)],
) -> CurrentUser:
    """
    Verify the bearer token of the request.

    Args:
        credentials: Parsed `Authorization` header, if any.
        verifier: Application token verifier.

    Returns:
        The identity of the caller.

    Raises:
        AuthenticationError: When the header is missing or the token is not valid.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AuthenticationError("A bearer access token is required")
    return verifier.verify(credentials.credentials)


def require_permission(permission: Permission) -> Callable[[CurrentUser], Awaitable[CurrentUser]]:
    """
    Build a dependency that only lets through callers whose token carries a permission.

    Args:
        permission: Permission the endpoint requires.

    Returns:
        The dependency, which returns the caller when allowed.
    """

    async def dependency(user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
        """
        Check the permissions of the caller.

        Args:
            user: Identity of the caller.

        Returns:
            The identity of the caller.

        Raises:
            PermissionDeniedError: When the token does not carry the permission.
        """
        if not user.has_permission(permission):
            raise PermissionDeniedError(
                f"This operation requires '{permission.value}'",
                details={"permission": permission.value},
            )
        return user

    return dependency


class PageParams:
    """Offset pagination query parameters, capped by `MAX_PAGE_SIZE`."""

    def __init__(
        self,
        settings: Annotated[Settings, Depends(get_settings_dependency)],
        limit: Annotated[int, Query(ge=1, description="Maximum items per page")] = 20,
        offset: Annotated[int, Query(ge=0, description="Items skipped")] = 0,
    ) -> None:
        """
        Read the pagination parameters of the request.

        Args:
            settings: Application settings.
            limit: Requested page size, reduced to `MAX_PAGE_SIZE` when larger.
            offset: Items skipped.
        """
        self.limit: int = min(limit, settings.max_page_size)
        self.offset: int = offset


def get_client_service(session: Annotated[AsyncSession, Depends(get_session)]) -> ClientService:
    """
    Build the client service bound to the session of the request.

    Args:
        session: Session of the current request.

    Returns:
        The client service.
    """
    return ClientService(ClientRepository(session))


def get_engine_service(session: Annotated[AsyncSession, Depends(get_session)]) -> EngineService:
    """
    Build the engine service bound to the session of the request.

    Args:
        session: Session of the current request.

    Returns:
        The engine service.
    """
    return EngineService(EngineRepository(session), ClientRepository(session))


def get_repair_order_service(session: Annotated[AsyncSession, Depends(get_session)]) -> RepairOrderService:
    """
    Build the repair order service bound to the session of the request.

    Args:
        session: Session of the current request.

    Returns:
        The repair order service.
    """
    return RepairOrderService(RepairOrderRepository(session), EngineRepository(session))


SessionDep = Annotated[AsyncSession, Depends(get_session)]
CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]
ClientsReadDep = Annotated[CurrentUser, Depends(require_permission(Permission.CLIENTS_READ))]
ClientsWriteDep = Annotated[CurrentUser, Depends(require_permission(Permission.CLIENTS_WRITE))]
EnginesReadDep = Annotated[CurrentUser, Depends(require_permission(Permission.ENGINES_READ))]
EnginesWriteDep = Annotated[CurrentUser, Depends(require_permission(Permission.ENGINES_WRITE))]
RepairOrdersReadDep = Annotated[CurrentUser, Depends(require_permission(Permission.REPAIR_ORDERS_READ))]
RepairOrdersWriteDep = Annotated[CurrentUser, Depends(require_permission(Permission.REPAIR_ORDERS_WRITE))]
PageParamsDep = Annotated[PageParams, Depends()]
ClientServiceDep = Annotated[ClientService, Depends(get_client_service)]
EngineServiceDep = Annotated[EngineService, Depends(get_engine_service)]
RepairOrderServiceDep = Annotated[RepairOrderService, Depends(get_repair_order_service)]
