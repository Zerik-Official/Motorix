"""Data access of clients."""

# Standard library
from __future__ import annotations
from collections.abc import Sequence
from uuid import UUID

# Third-party
from sqlalchemy import ColumnElement, or_

# Project imports
from app.models.client import Client, IdentificationType
from app.repositories.base import BaseRepository


class ClientRepository(BaseRepository[Client]):
    """Reads and writes clients, including the duplicate identification check."""

    model = Client

    async def exists_with_identification(
        self,
        identification_type: IdentificationType,
        identification_number: str,
        exclude_id: UUID | None = None,
    ) -> bool:
        """
        Tell whether another client already uses this identification.

        Args:
            identification_type: Type of the identification document.
            identification_number: Number of the identification document.
            exclude_id: Client excluded from the check, used when updating that same client.

        Returns:
            True when a different client already has this identification.
        """
        filters: list[ColumnElement[bool]] = [
            Client.identification_type == identification_type,
            Client.identification_number == identification_number,
        ]
        if exclude_id is not None:
            filters.append(Client.id != exclude_id)
        return await self.exists(filters)

    async def list_page(
        self,
        offset: int,
        limit: int,
        search: str | None = None,
        is_active: bool | None = None,
    ) -> Sequence[Client]:
        """
        Fetch one page of clients.

        Args:
            offset: Rows skipped.
            limit: Maximum rows returned.
            search: Case insensitive match on the name or the identification number.
            is_active: Keep only active or only inactive clients when set.

        Returns:
            The rows of the page, ordered by creation date.
        """
        filters: list[ColumnElement[bool]] = []
        if search:
            pattern: str = f"%{search}%"
            filters.append(or_(Client.name.ilike(pattern), Client.identification_number.ilike(pattern)))
        if is_active is not None:
            filters.append(Client.is_active == is_active)
        return await self.list(offset, limit, filters=filters, order_by=[Client.created_at.desc()])

    async def count_page(self, search: str | None = None, is_active: bool | None = None) -> int:
        """
        Count the clients matching the same filters as `list_page`.

        Args:
            search: Case insensitive match on the name or the identification number.
            is_active: Keep only active or only inactive clients when set.

        Returns:
            The number of matching clients.
        """
        filters: list[ColumnElement[bool]] = []
        if search:
            pattern: str = f"%{search}%"
            filters.append(or_(Client.name.ilike(pattern), Client.identification_number.ilike(pattern)))
        if is_active is not None:
            filters.append(Client.is_active == is_active)
        return await self.count(filters)
