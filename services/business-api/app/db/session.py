"""Async engine and session factory of the service database."""

# Standard library
from __future__ import annotations
from collections.abc import AsyncIterator

# Third-party
from sqlalchemy import text
from sqlalchemy.engine import URL
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine


class Database:
    """Owns the connection pool and hands out one session per unit of work."""

    def __init__(self, url: URL | str, pool_size: int = 5, max_overflow: int = 10, echo: bool = False) -> None:
        """
        Create the engine; no connection is opened until the first query.

        Args:
            url: Async SQLAlchemy URL.
            pool_size: Connections kept open in the pool.
            max_overflow: Extra connections allowed under load.
            echo: Print every SQL statement.
        """
        self._engine: AsyncEngine = create_async_engine(
            url,
            pool_size=pool_size,
            max_overflow=max_overflow,
            pool_pre_ping=True,
            echo=echo,
        )
        self._session_factory: async_sessionmaker[AsyncSession] = async_sessionmaker(
            self._engine,
            expire_on_commit=False,
        )

    @property
    def engine(self) -> AsyncEngine:
        """Underlying async engine."""
        return self._engine

    async def session(self) -> AsyncIterator[AsyncSession]:
        """
        Yield a session that commits on success and rolls back on failure.

        Yields:
            The session of the unit of work.
        """
        async with self._session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    async def ping(self) -> bool:
        """
        Check that the database answers.

        Returns:
            True when a trivial query succeeds.
        """
        try:
            async with self._engine.connect() as connection:
                await connection.execute(text("SELECT 1"))
            return True
        except (SQLAlchemyError, OSError, TimeoutError):
            return False

    async def dispose(self) -> None:
        """Close every pooled connection."""
        await self._engine.dispose()
