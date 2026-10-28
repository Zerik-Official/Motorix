"""Application factory of business-api."""

# Standard library
from __future__ import annotations
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

# Third-party
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Project imports
from app.api.v1.router import api_router
from app.api.v1.routers import health
from app.core.config import Settings, get_settings
from app.core.errors import register_error_handlers
from app.core.log_files import close_service_logs, setup_service_logs
from app.core.logging import configure_logging, log
from app.core.security import JwtVerifier
from app.db.session import Database


def create_app(settings: Settings | None = None, database: Database | None = None) -> FastAPI:
    """
    Build the application with its middleware, routers and error handlers.

    Args:
        settings: Settings to use; read from the environment when omitted.
        database: Database to use; created from the settings when omitted.

    Returns:
        The configured application.
    """
    resolved: Settings = settings if settings is not None else get_settings()
    configure_logging(resolved.log_level, resolved.log_verbosity, resolved.log_suppress)
    if resolved.log_to_file:
        setup_service_logs(resolved.app_name, resolved.log_directory, configure_logging=False)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        """
        Open the shared resources on startup and release them on shutdown.

        Args:
            app: Application being served.

        Yields:
            Control to the server while the application runs.
        """
        log("INFO", f"Starting {resolved.app_name} in {resolved.environment.value} environment")
        if not await app.state.database.ping():
            log("WARNING", "The database is not reachable yet")
        yield
        await app.state.database.dispose()
        log("INFO", f"Stopped {resolved.app_name}")
        close_service_logs()

    app: FastAPI = FastAPI(
        title="Motorix business API",
        description="Clients, engines and repair orders of the Motorix workshop.",
        version="0.1.0",
        docs_url="/docs" if resolved.docs_enabled else None,
        redoc_url="/redoc" if resolved.docs_enabled else None,
        openapi_url="/openapi.json" if resolved.docs_enabled else None,
        lifespan=lifespan,
    )
    app.state.settings = resolved
    app.state.database = database if database is not None else Database(
        resolved.database_url,
        pool_size=resolved.db_pool_size,
        max_overflow=resolved.db_max_overflow,
        echo=resolved.db_echo,
    )
    app.state.jwt_verifier = JwtVerifier(
        public_key=resolved.read_public_key(),
        issuer=resolved.jwt_issuer,
        audience=resolved.jwt_audience,
        leeway_seconds=resolved.jwt_leeway_seconds,
    )
    if resolved.cors_origin_list:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=resolved.cors_origin_list,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
            allow_headers=["Authorization", "Content-Type"],
        )
    register_error_handlers(app)
    app.include_router(health.router)
    app.include_router(api_router)
    return app
