"""Business rules of clients: duplicate identification and soft delete."""

# Standard library
from __future__ import annotations
from collections.abc import Sequence
from uuid import UUID

# Project imports
from app.core.errors import ConflictError, NotFoundError
from app.models.client import Client
from app.repositories.client import ClientRepository
from app.schemas.client import ClientCreate, ClientUpdate


class ClientService:
    """Validates and applies changes to clients through their repository."""

    def __init__(self, repository: ClientRepository) -> None:
        """
        Create the service.

        Args:
            repository: Repository bound to the session of the current request.
        """
        self._repository: ClientRepository = repository

    async def create(self, data: ClientCreate) -> Client:
        """
        Register a new client.

        Args:
            data: Fields of the new client.

        Returns:
            The persisted client.

        Raises:
            ConflictError: When another client already has the same identification.
        """
        if await self._repository.exists_with_identification(data.identification_type, data.identification_number):
            raise ConflictError("A client with this identification already exists")
        client: Client = Client(**data.model_dump())
        return await self._repository.add(client)

    async def get(self, client_id: UUID) -> Client:
        """
        Fetch one client.

        Args:
            client_id: Identifier of the client.

        Returns:
            The client.

        Raises:
            NotFoundError: When no client has this identifier.
        """
        client: Client | None = await self._repository.get(client_id)
        if client is None:
            raise NotFoundError("Client not found")
        return client

    async def list(
        self,
        offset: int,
        limit: int,
        search: str | None = None,
        is_active: bool | None = None,
    ) -> tuple[Sequence[Client], int]:
        """
        List clients and count how many match the same filters.

        Args:
            offset: Rows skipped.
            limit: Maximum rows returned.
            search: Case insensitive match on the name or the identification number.
            is_active: Keep only active or only inactive clients when set.

        Returns:
            The page of clients and the total count of matches.
        """
        items: Sequence[Client] = await self._repository.list_page(offset, limit, search, is_active)
        total: int = await self._repository.count_page(search, is_active)
        return items, total

    async def update(self, client_id: UUID, data: ClientUpdate) -> Client:
        """
        Replace the editable fields of a client.

        Args:
            client_id: Identifier of the client.
            data: New values of every editable field.

        Returns:
            The updated client.

        Raises:
            NotFoundError: When no client has this identifier.
            ConflictError: When another client already has the new identification.
        """
        client: Client = await self.get(client_id)
        if await self._repository.exists_with_identification(
            data.identification_type,
            data.identification_number,
            exclude_id=client.id,
        ):
            raise ConflictError("A client with this identification already exists")
        for field, value in data.model_dump().items():
            setattr(client, field, value)
        return await self._repository.save(client)

    async def deactivate(self, client_id: UUID) -> Client:
        """
        Deactivate a client without deleting its row, so its history is preserved.

        Args:
            client_id: Identifier of the client.

        Returns:
            The deactivated client.

        Raises:
            NotFoundError: When no client has this identifier.
        """
        client: Client = await self.get(client_id)
        client.is_active = False
        return await self._repository.save(client)
