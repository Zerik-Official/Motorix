"""Verification of the RS256 access tokens issued by auth-api."""

# Standard library
from __future__ import annotations
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any, Final
from uuid import UUID

# Third-party
import jwt
from pydantic import BaseModel, ConfigDict, ValidationError

# Project imports
from app.core.errors import AuthenticationError

ALGORITHM: Final[str] = "RS256"
REQUIRED_CLAIMS: Final[list[str]] = ["sub", "role", "iss", "aud", "iat", "exp"]


class Role(StrEnum):
    """Authorization roles, from the most to the least privileged."""

    ROOT = "root"
    ADMIN = "admin"
    USER = "user"


class CurrentUser(BaseModel):
    """Identity of the caller, taken from a verified access token."""

    model_config = ConfigDict(frozen=True)

    id: UUID
    role: Role
    expires_at: datetime


class JwtVerifier:
    """Verifies signature, expiration, issuer and audience of access tokens with the public key."""

    def __init__(self, public_key: str, issuer: str, audience: str, leeway_seconds: int = 0) -> None:
        """
        Create the verifier.

        Args:
            public_key: PEM encoded RSA public key of auth-api.
            issuer: Expected `iss` claim.
            audience: Expected `aud` claim.
            leeway_seconds: Clock skew tolerated when checking `exp` and `iat`.
        """
        self._public_key: str = public_key
        self._issuer: str = issuer
        self._audience: str = audience
        self._leeway: int = leeway_seconds

    def verify(self, token: str) -> CurrentUser:
        """
        Verify a token and extract the identity it carries.

        Args:
            token: Encoded JWT received in the `Authorization` header.

        Returns:
            The identity of the caller.

        Raises:
            AuthenticationError: When the token is expired, forged, issued for another audience
                or carries malformed claims.
        """
        try:
            claims: dict[str, Any] = jwt.decode(
                token,
                self._public_key,
                algorithms=[ALGORITHM],
                audience=self._audience,
                issuer=self._issuer,
                leeway=self._leeway,
                options={"require": REQUIRED_CLAIMS},
            )
        except jwt.ExpiredSignatureError as exc:
            raise AuthenticationError("The access token has expired") from exc
        except jwt.InvalidTokenError as exc:
            raise AuthenticationError("The access token is not valid") from exc
        try:
            return CurrentUser(
                id=claims["sub"],
                role=claims["role"],
                expires_at=datetime.fromtimestamp(int(claims["exp"]), tz=timezone.utc),
            )
        except (ValidationError, TypeError, ValueError) as exc:
            raise AuthenticationError("The access token carries invalid claims") from exc
