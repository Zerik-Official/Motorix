"""Business rules of repair orders: order numbering, owner derivation and status history."""

# Standard library
from __future__ import annotations
from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import UUID, uuid4

# Project imports
from app.core.errors import BusinessRuleError, NotFoundError
from app.models.engine import Engine
from app.models.repair_order import RepairOrder, RepairOrderStatus, RepairOrderStatusHistory
from app.repositories.engine import EngineRepository
from app.repositories.repair_order import RepairOrderRepository
from app.schemas.repair_order import RepairOrderCreate, RepairOrderStatusUpdate


class RepairOrderService:
    """Validates and applies changes to repair orders through their repository."""

    def __init__(self, repository: RepairOrderRepository, engine_repository: EngineRepository) -> None:
        """
        Create the service.

        Args:
            repository: Repair order repository bound to the session of the current request.
            engine_repository: Engine repository used to derive the order's owner.
        """
        self._repository: RepairOrderRepository = repository
        self._engines: EngineRepository = engine_repository

    async def create(self, data: RepairOrderCreate, created_by: UUID) -> RepairOrder:
        """
        Register a new repair order for an existing engine.

        The owning client is not taken from the request: it is the current owner of the
        engine, so an order can never point to a client that does not actually own it.

        Args:
            data: Fields of the new order.
            created_by: Identifier of the authenticated caller, from the access token.

        Returns:
            The persisted order, with its engine, client and initial history entry loaded.

        Raises:
            NotFoundError: When the engine does not exist.
        """
        engine: Engine | None = await self._engines.get(data.engine_id)
        if engine is None:
            raise NotFoundError("Engine not found")
        order: RepairOrder = RepairOrder(
            order_number=self._generate_order_number(),
            engine_id=engine.id,
            client_id=engine.client_id,
            reported_issue=data.reported_issue,
            diagnosis=data.diagnosis,
            work_performed=data.work_performed,
            technician_name=data.technician_name,
            estimated_delivery_date=data.estimated_delivery_date,
            observations=data.observations,
            status=RepairOrderStatus.RECEIVED,
            created_by=created_by,
        )
        order = await self._repository.add(order)
        await self._repository.add_history_entry(
            RepairOrderStatusHistory(
                repair_order_id=order.id,
                from_status=None,
                to_status=RepairOrderStatus.RECEIVED,
                note="Orden recibida",
                changed_by=created_by,
            ),
        )
        return await self._get_with_relations(order.id)

    async def get(self, order_id: UUID) -> RepairOrder:
        """
        Fetch one repair order with its engine, client and status history.

        Args:
            order_id: Identifier of the order.

        Returns:
            The order.

        Raises:
            NotFoundError: When no order has this identifier.
        """
        return await self._get_with_relations(order_id)

    async def list(
        self,
        limit: int,
        cursor: tuple[datetime, UUID] | None = None,
        status: RepairOrderStatus | None = None,
        client_id: UUID | None = None,
        engine_id: UUID | None = None,
        search: str | None = None,
    ) -> Sequence[RepairOrder]:
        """
        List repair orders with keyset pagination.

        Args:
            limit: Maximum rows returned.
            cursor: Position of the last row of the previous page; omitted for the first page.
            status: Keep only orders with this status when set.
            client_id: Keep only the orders of this client when set.
            engine_id: Keep only the orders of this engine when set.
            search: Keep only the orders whose number, reported issue, engine serial number or client
                name contains this text when set.

        Returns:
            The rows of the page, with their engine and client already loaded.
        """
        return await self._repository.list_page(limit, cursor, status, client_id, engine_id, search)

    async def summary(self) -> dict[RepairOrderStatus, int]:
        """
        Count the repair orders of every status, in the order the workshop moves through them.

        Returns:
            The number of orders per status, including the statuses without orders.
        """
        counts: dict[RepairOrderStatus, int] = await self._repository.count_by_status()
        return {status: counts.get(status, 0) for status in RepairOrderStatus}

    async def update_status(self, order_id: UUID, data: RepairOrderStatusUpdate, changed_by: UUID) -> RepairOrder:
        """
        Move a repair order to a different status and record the change in its history.

        Args:
            order_id: Identifier of the order.
            data: New status and an optional note.
            changed_by: Identifier of the authenticated caller, from the access token.

        Returns:
            The updated order.

        Raises:
            NotFoundError: When no order has this identifier.
            BusinessRuleError: When the order already has the requested status.
        """
        order: RepairOrder = await self._get_with_relations(order_id)
        if order.status == data.status:
            raise BusinessRuleError("The order already has this status")
        await self._repository.add_history_entry(
            RepairOrderStatusHistory(
                repair_order_id=order.id,
                from_status=order.status,
                to_status=data.status,
                note=data.note,
                changed_by=changed_by,
            ),
        )
        order.status = data.status
        if data.status is RepairOrderStatus.DELIVERED and order.delivered_at is None:
            order.delivered_at = datetime.now(timezone.utc)
        await self._repository.save(order)
        return await self._get_with_relations(order_id)

    async def _get_with_relations(self, order_id: UUID) -> RepairOrder:
        """
        Fetch one repair order with its engine, client and status history, or fail.

        Args:
            order_id: Identifier of the order.

        Returns:
            The order.

        Raises:
            NotFoundError: When no order has this identifier.
        """
        order: RepairOrder | None = await self._repository.get_with_relations(order_id)
        if order is None:
            raise NotFoundError("Repair order not found")
        return order

    @staticmethod
    def _generate_order_number() -> str:
        """
        Build a short, human readable and practically unique order number.

        Returns:
            A number such as `RO-2026-9F3A2B10`; uniqueness is still enforced by the
            database constraint, but a collision is astronomically unlikely.
        """
        year: int = datetime.now(timezone.utc).year
        suffix: str = uuid4().hex[:8].upper()
        return f"RO-{year}-{suffix}"
