"""Entry point that serves the application with uvicorn: `python -m app`."""

# Third-party
import uvicorn

# Project imports
from app.core.config import Settings, get_settings
from app.core.log_files import uvicorn_log_config


def main() -> None:
    """Serve the application on the configured host and port."""
    settings: Settings = get_settings()
    uvicorn.run(
        "app.main:create_app",
        factory=True,
        host=settings.host,
        port=settings.port,
        log_config=uvicorn_log_config(),
        proxy_headers=True,
    )


if __name__ == "__main__":
    main()
