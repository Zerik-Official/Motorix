"""SQLAlchemy models; every model is imported here so Alembic sees its table."""

# Project imports
from app.db.base import Base
from app.models.client import Client, IdentificationType

__all__ = ["Base", "Client", "IdentificationType"]
