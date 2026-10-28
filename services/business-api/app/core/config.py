"""Application settings resolved once from environment variables and the service `.env` file."""

# Standard library
from __future__ import annotations
from enum import StrEnum
from functools import lru_cache
from pathlib import Path
from typing import Final

# Third-party
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL

BASE_DIR: Final[Path] = Path(__file__).resolve().parents[2]
"""Root folder of the service, where `.env`, `alembic.ini` and `logs/` live."""


class Environment(StrEnum):
    """Deployment environment the service runs in."""

    LOCAL = "local"
    TEST = "test"
    STAGING = "staging"
    PRODUCTION = "production"


class Settings(BaseSettings):
    """Every setting of the service, read from environment variables."""

    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "business-api"
    environment: Environment = Environment.LOCAL
    host: str = "0.0.0.0"
    port: int = Field(default=8000, ge=1, le=65535)
    docs_enabled: bool = True
    cors_origins: str = ""

    db_host: str = "localhost"
    db_port: int = Field(default=5432, ge=1, le=65535)
    db_name: str = "business_db"
    db_user: str = "business_service"
    db_password: str = ""
    db_pool_size: int = Field(default=5, ge=1)
    db_max_overflow: int = Field(default=10, ge=0)
    db_echo: bool = False

    jwt_public_key_path: Path | None = None
    jwt_public_key: str = ""
    jwt_issuer: str = "motorix-auth-api"
    jwt_audience: str = "motorix-business-api"
    jwt_leeway_seconds: int = Field(default=10, ge=0)

    max_page_size: int = Field(default=100, ge=1)

    log_level: str = "INFO"
    log_verbosity: int = Field(default=1, ge=1)
    log_suppress: str = ""
    log_to_file: bool = True
    log_dir: Path = Path("logs")

    @property
    def database_url(self) -> URL:
        """Async SQLAlchemy URL of the service database."""
        return URL.create(
            drivername="postgresql+asyncpg",
            username=self.db_user,
            password=self.db_password,
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
        )

    @property
    def cors_origin_list(self) -> list[str]:
        """Allowed CORS origins parsed from the comma separated `CORS_ORIGINS`."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def log_directory(self) -> Path:
        """Absolute folder of the log files; relative paths are resolved from the service root."""
        return self.log_dir if self.log_dir.is_absolute() else BASE_DIR / self.log_dir

    def read_public_key(self) -> str:
        """
        Load the PEM public key used to verify tokens.

        Returns:
            The inline key when `JWT_PUBLIC_KEY` is set, otherwise the contents of `JWT_PUBLIC_KEY_PATH`.

        Raises:
            ValueError: When neither `JWT_PUBLIC_KEY` nor `JWT_PUBLIC_KEY_PATH` is set.
        """
        if self.jwt_public_key.strip():
            return self.jwt_public_key.replace("\\n", "\n")
        if self.jwt_public_key_path is None:
            raise ValueError("JWT_PUBLIC_KEY or JWT_PUBLIC_KEY_PATH must be set")
        path: Path = self.jwt_public_key_path
        resolved: Path = path if path.is_absolute() else BASE_DIR / path
        return resolved.read_text(encoding="utf-8")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Build the settings once per process.

    Returns:
        The cached settings.
    """
    return Settings()
