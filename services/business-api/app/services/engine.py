"""Business rules of engines: duplicate serial number, owner validation and soft delete."""

# Standard library
from __future__ import annotations
from collections.abc import Sequence
from uuid import UUID

# Project imports
from app.core.errors import ConflictError, NotFoundError
from app.models.engine import Engine
from app.repositories.client import ClientRepository
from app.repositories.engine import EngineRepository
from app.schemas.engine import EngineCreate, EngineUpdate


class EngineService:
    """Validates and applies changes to engines through their repository."""

    def __init__(self, repository: EngineRepository, client_repository: ClientRepository) -> None:
        """
        Create the service.

        Args:
            repository: Engine repository bound to the session of the current request.
            client_repository: Client repository used to validate the owner of the engine.
        """
        self._repository: EngineRepository = repository
        self._clients: ClientRepository = client_repository

    async def create(self, data: EngineCreate) -> Engine:
        """
        Register a new engine.

        Args:
            data: Fields of the new engine.

        Returns:
            The persisted engine with its owner.

        Raises:
            NotFoundError: When the owning client does not exist.
            ConflictError: When another engine already has the same serial number.
        """
        await self._require_client(data.client_id)
        if await self._repository.exists_with_serial_number(data.serial_number):
            raise ConflictError("An engine with this serial number already exists")
        engine: Engine = await self._repository.add(Engine(**data.model_dump()))
        return await self.get(engine.id)

    async def get(self, engine_id: UUID) -> Engine:
        """
        Fetch one engine with its owner.

        Args:
            engine_id: Identifier of the engine.

        Returns:
            The engine.

        Raises:
            NotFoundError: When no engine has this identifier.
        """
        engine: Engine | None = await self._repository.get_with_client(engine_id)
        if engine is None:
            raise NotFoundError("Engine not found")
        return engine

    async def list(
        self,
        offset: int,
        limit: int,
        search: str | None = None,
        client_id: UUID | None = None,
        is_active: bool | None = None,
    ) -> tuple[Sequence[Engine], int]:
        """
        List engines and count how many match the same filters.

        Args:
            offset: Rows skipped.
            limit: Maximum rows returned.
            search: Case insensitive match on the serial number, manufacturer or model.
            client_id: Keep only the engines of this client when set.
            is_active: Keep only active or only inactive engines when set.

        Returns:
            The page of engines with their owners and the total count of matches.
        """
        items: Sequence[Engine] = await self._repository.list_page(offset, limit, search, client_id, is_active)
        total: int = await self._repository.count_page(search, client_id, is_active)
        return items, total

    async def update(self, engine_id: UUID, data: EngineUpdate) -> Engine:
        """
        Replace the editable fields of an engine.

        Args:
            engine_id: Identifier of the engine.
            data: New values of every editable field; `is_active` is only changed when sent.

        Returns:
            The updated engine with its current owner.

        Raises:
            NotFoundError: When the engine or the referenced owner does not exist.
            ConflictError: When another engine already has the new serial number.
        """
        engine: Engine = await self.get(engine_id)
        await self._require_client(data.client_id)
        if await self._repository.exists_with_serial_number(data.serial_number, exclude_id=engine.id):
            raise ConflictError("An engine with this serial number already exists")
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(engine, field, value)
        await self._repository.save(engine)
        return await self.get(engine.id)

    async def deactivate(self, engine_id: UUID) -> Engine:
        """
        Deactivate an engine without deleting its row, so its repair history is preserved.

        Args:
            engine_id: Identifier of the engine.

        Returns:
            The deactivated engine with its owner.

        Raises:
            NotFoundError: When no engine has this identifier.
        """
        engine: Engine = await self.get(engine_id)
        engine.is_active = False
        await self._repository.save(engine)
        return await self.get(engine.id)

    async def _require_client(self, client_id: UUID) -> None:
        """
        Ensure the owner of an engine exists.

        Args:
            client_id: Identifier of the client.

        Raises:
            NotFoundError: When no client has this identifier.
        """
        if await self._clients.get(client_id) is None:
            raise NotFoundError("Client not found")
