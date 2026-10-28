"""Health check of the service and its dependencies."""

# Standard library
from __future__ import annotations
from typing import Protocol

# Project imports
from app.schemas.system import ComponentStatus, HealthResponse


class Pingable(Protocol):
    """Dependency that can report whether it answers."""

    async def ping(self) -> bool:
        """
        Check the dependency.

        Returns:
            True when it answers.
        """
        ...


class HealthService:
    """Reports the state of the service from the state of its dependencies."""

    def __init__(self, database: Pingable) -> None:
        """
        Create the service.

        Args:
            database: Database of the service.
        """
        self._database: Pingable = database

    async def check(self) -> HealthResponse:
        """
        Check every dependency.

        Returns:
            OK when every dependency answers, UNAVAILABLE otherwise.
        """
        database: ComponentStatus = ComponentStatus.OK if await self._database.ping() else ComponentStatus.UNAVAILABLE
        return HealthResponse(status=database, database=database)
