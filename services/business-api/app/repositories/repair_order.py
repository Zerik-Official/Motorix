"""Data access of repair orders: keyset pagination, search, status counts and eager loading of their relations."""

# Standard library
from __future__ import annotations
import base64
import binascii
from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

# Third-party
from sqlalchemy import ColumnElement, Row, Select, and_, exists, func, or_, select
from sqlalchemy.orm import selectinload

# Project imports
from app.models.client import Client
from app.models.engine import Engine
from app.models.repair_order import RepairOrder, RepairOrderStatus, RepairOrderStatusHistory
from app.repositories.base import BaseRepository

_CURSOR_SEPARATOR = "|"
_LIKE_ESCAPE = "\\"


def _contains_pattern(text: str) -> str:
    """
    Build a case-insensitive `LIKE` pattern that matches the text anywhere, taking it literally.

    Args:
        text: Text typed by the user, whose `%` and `_` must not act as wildcards.

    Returns:
        The pattern, escaped with `_LIKE_ESCAPE`.
    """
    escaped: str = (
        text.replace(_LIKE_ESCAPE, _LIKE_ESCAPE * 2).replace("%", f"{_LIKE_ESCAPE}%").replace("_", f"{_LIKE_ESCAPE}_")
    )
    return f"%{escaped}%"


def _search_filter(text: str) -> ColumnElement[bool]:
    """
    Match orders by order number, reported issue, engine serial number or client name.

    The engine and client conditions are correlated `EXISTS` subqueries, so the whole search stays
    a single statement no matter how many orders match.

    Args:
        text: Text typed by the user.

    Returns:
        The condition.
    """
    pattern: str = _contains_pattern(text)
    return or_(
        RepairOrder.order_number.ilike(pattern, escape=_LIKE_ESCAPE),
        RepairOrder.reported_issue.ilike(pattern, escape=_LIKE_ESCAPE),
        exists().where(Engine.id == RepairOrder.engine_id, Engine.serial_number.ilike(pattern, escape=_LIKE_ESCAPE)),
        exists().where(Client.id == RepairOrder.client_id, Client.name.ilike(pattern, escape=_LIKE_ESCAPE)),
    )


def encode_cursor(created_at: datetime, order_id: UUID) -> str:
    """
    Encode the keyset position of a row into an opaque cursor.

    Args:
        created_at: Creation timestamp of the row.
        order_id: Identifier of the row, which breaks ties on equal timestamps.

    Returns:
        The opaque cursor.
    """
    raw: str = f"{created_at.isoformat()}{_CURSOR_SEPARATOR}{order_id}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")


def decode_cursor(cursor: str) -> tuple[datetime, UUID]:
    """
    Decode an opaque cursor back into its keyset position.

    Args:
        cursor: Cursor produced by `encode_cursor`.

    Returns:
        The creation timestamp and identifier of the row the page continues after.

    Raises:
        ValueError: When the cursor is malformed.
    """
    try:
        raw: str = base64.urlsafe_b64decode(cursor.encode("ascii")).decode("utf-8")
        created_at_text, order_id_text = raw.split(_CURSOR_SEPARATOR)
        return datetime.fromisoformat(created_at_text), UUID(order_id_text)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Invalid cursor") from exc


class RepairOrderRepository(BaseRepository[RepairOrder]):
    """Reads and writes repair orders, keeping their engine and client loaded in one round trip."""

    model = RepairOrder

    async def list_page(
        self,
        limit: int,
        cursor: tuple[datetime, UUID] | None = None,
        status: RepairOrderStatus | None = None,
        client_id: UUID | None = None,
        engine_id: UUID | None = None,
        search: str | None = None,
    ) -> Sequence[RepairOrder]:
        """
        Fetch one keyset page of repair orders, newest first.

        Args:
            limit: Maximum rows returned.
            cursor: Position of the last row of the previous page; omitted for the first page.
            status: Keep only orders with this status when set.
            client_id: Keep only the orders of this client when set.
            engine_id: Keep only the orders of this engine when set.
            search: Keep only the orders whose number, reported issue, engine serial number or client
                name contains this text, ignoring case, when set.

        Returns:
            The rows of the page, with their engine and client already loaded.
        """
        filters: list[ColumnElement[bool]] = []
        if status is not None:
            filters.append(RepairOrder.status == status)
        if client_id is not None:
            filters.append(RepairOrder.client_id == client_id)
        if engine_id is not None:
            filters.append(RepairOrder.engine_id == engine_id)
        if search:
            filters.append(_search_filter(search))
        statement: Select[tuple[RepairOrder]] = (
            select(RepairOrder)
            .where(*filters)
            .options(selectinload(RepairOrder.engine), selectinload(RepairOrder.client))
            .order_by(RepairOrder.created_at.desc(), RepairOrder.id.desc())
            .limit(limit)
        )
        if cursor is not None:
            created_at, order_id = cursor
            statement = statement.where(
                or_(
                    RepairOrder.created_at < created_at,
                    and_(RepairOrder.created_at == created_at, RepairOrder.id < order_id),
                ),
            )
        return (await self._session.execute(statement)).scalars().all()

    async def count_by_status(self) -> dict[RepairOrderStatus, int]:
        """
        Count the repair orders of each status with a single `GROUP BY` query.

        Returns:
            The number of orders per status; statuses without orders are absent.
        """
        statement: Select[tuple[RepairOrderStatus, int]] = select(RepairOrder.status, func.count()).group_by(
            RepairOrder.status,
        )
        rows: Sequence[Row[tuple[RepairOrderStatus, int]]] = (await self._session.execute(statement)).all()
        return {status: count for status, count in rows}

    async def get_with_relations(self, order_id: UUID) -> RepairOrder | None:
        """
        Fetch one repair order with its engine, client and status history already loaded.

        Args:
            order_id: Identifier of the repair order.

        Returns:
            The repair order, or None when it does not exist.
        """
        options = (
            selectinload(RepairOrder.engine),
            selectinload(RepairOrder.client),
            selectinload(RepairOrder.history),
        )
        return await self.get(order_id, options=options)

    async def add_history_entry(self, entry: RepairOrderStatusHistory) -> RepairOrderStatusHistory:
        """
        Insert one status history row, without touching the parent order's loaded relationships.

        Args:
            entry: New history row, with `repair_order_id` already set.

        Returns:
            The inserted row.
        """
        self._session.add(entry)
        await self._session.flush()
        return entry
