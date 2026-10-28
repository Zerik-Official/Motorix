"""Data access of engines."""

# Standard library
from __future__ import annotations
from collections.abc import Sequence
from uuid import UUID

# Third-party
from sqlalchemy import ColumnElement, or_
from sqlalchemy.orm import selectinload

# Project imports
from app.models.engine import Engine
from app.repositories.base import BaseRepository


class EngineRepository(BaseRepository[Engine]):
    """Reads and writes engines, including the duplicate serial number check."""

    model = Engine

    async def get_with_client(self, engine_id: UUID) -> Engine | None:
        """
        Fetch one engine with its owner loaded in the same round trip.

        Args:
            engine_id: Identifier of the engine.

        Returns:
            The engine, or None when it does not exist.
        """
        return await self.get(engine_id, options=(selectinload(Engine.client),))

    async def exists_with_serial_number(self, serial_number: str, exclude_id: UUID | None = None) -> bool:
        """
        Tell whether another engine already uses this serial number.

        Args:
            serial_number: Serial number to check.
            exclude_id: Engine excluded from the check, used when updating that same engine.

        Returns:
            True when a different engine already has this serial number.
        """
        filters: list[ColumnElement[bool]] = [Engine.serial_number == serial_number]
        if exclude_id is not None:
            filters.append(Engine.id != exclude_id)
        return await self.exists(filters)

    async def list_page(
        self,
        offset: int,
        limit: int,
        search: str | None = None,
        client_id: UUID | None = None,
        is_active: bool | None = None,
    ) -> Sequence[Engine]:
        """
        Fetch one page of engines.

        Args:
            offset: Rows skipped.
            limit: Maximum rows returned.
            search: Case insensitive match on the serial number, manufacturer or model.
            client_id: Keep only the engines of this client when set.
            is_active: Keep only active or only inactive engines when set.

        Returns:
            The rows of the page, ordered by registration date, with their owners loaded in one batch.
        """
        filters: list[ColumnElement[bool]] = self._filters(search, client_id, is_active)
        return await self.list(
            offset,
            limit,
            filters=filters,
            order_by=[Engine.registered_at.desc()],
            options=[selectinload(Engine.client)],
        )

    async def count_page(
        self,
        search: str | None = None,
        client_id: UUID | None = None,
        is_active: bool | None = None,
    ) -> int:
        """
        Count the engines matching the same filters as `list_page`.

        Args:
            search: Case insensitive match on the serial number, manufacturer or model.
            client_id: Keep only the engines of this client when set.
            is_active: Keep only active or only inactive engines when set.

        Returns:
            The number of matching engines.
        """
        return await self.count(self._filters(search, client_id, is_active))

    def _filters(
        self,
        search: str | None,
        client_id: UUID | None,
        is_active: bool | None,
    ) -> list[ColumnElement[bool]]:
        """
        Build the filters shared by `list_page` and `count_page`.

        Args:
            search: Case insensitive match on the serial number, manufacturer or model.
            client_id: Keep only the engines of this client when set.
            is_active: Keep only active or only inactive engines when set.

        Returns:
            The filters to combine with AND.
        """
        filters: list[ColumnElement[bool]] = []
        if search:
            pattern: str = f"%{search}%"
            filters.append(
                or_(
                    Engine.serial_number.ilike(pattern),
                    Engine.manufacturer.ilike(pattern),
                    Engine.model.ilike(pattern),
                ),
            )
        if client_id is not None:
            filters.append(Engine.client_id == client_id)
        if is_active is not None:
            filters.append(Engine.is_active == is_active)
        return filters
