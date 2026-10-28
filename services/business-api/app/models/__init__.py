"""SQLAlchemy models; every model is imported here so Alembic sees its table."""

# Project imports
from app.db.base import Base

__all__ = ["Base"]
