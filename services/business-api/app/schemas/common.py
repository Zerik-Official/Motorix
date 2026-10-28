"""Schemas shared by every endpoint: pagination and error bodies."""

# Standard library
from __future__ import annotations
from typing import Any, Generic, TypeVar

# Third-party
from pydantic import BaseModel, Field

ItemT = TypeVar("ItemT")


class Page(BaseModel, Generic[ItemT]):
    """One page of an offset paginated listing."""

    items: list[ItemT]
    total: int = Field(ge=0)
    limit: int = Field(ge=1)
    offset: int = Field(ge=0)


class CursorPage(BaseModel, Generic[ItemT]):
    """One page of a keyset paginated listing."""

    items: list[ItemT]
    limit: int = Field(ge=1)
    next_cursor: str | None = None


class ErrorDetail(BaseModel):
    """Description of a failure."""

    code: str
    message: str
    details: Any = None


class ErrorResponse(BaseModel):
    """Body of every error response."""

    error: ErrorDetail
