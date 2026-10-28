"""
Log files of the service: one folder per service and one file per day.

The service calls `setup_service_logs` once when it starts. From then on everything it prints
with `app.core.logging.log`, and everything the standard `logging` module records, is also
appended to `<log_dir>/<service>/<YYYY-MM>/<YYYY-MM-DD>.log`, without the colors of the console.
The file of the day is chosen on every line, so a process that runs past midnight moves to
the next file on its own.

Successful health checks are left out of the files and of the console: they say nothing
and bury everything else.
"""

# Standard library
from __future__ import annotations
import copy
import logging
import re
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Any, Final, TextIO

# Third-party
from uvicorn.config import LOGGING_CONFIG

MONTH_FORMAT: Final[str] = "%Y-%m"
DAY_FORMAT: Final[str] = "%Y-%m-%d"
RECORD_FORMAT: Final[str] = "%(asctime)s [%(name)s] %(levelname)s: %(message)s"
ANSI_PATTERN: Final[re.Pattern[str]] = re.compile(r"\x1b\[[0-9;]*m")
ACCESS_LOGGERS: Final[tuple[str, ...]] = ("uvicorn.access",)
HEALTH_PATTERN: Final[re.Pattern[str]] = re.compile(r'"GET /health[ ?][^"]*" 200')
"""Access log line of a health check that succeeded."""


class _DailyFile:
    """Appends lines to the file of the current day of a service."""

    def __init__(self) -> None:
        """Start without a folder: nothing is written until one is set."""
        self._directory: Path | None = None
        self._day: str = ""
        self._handle: TextIO | None = None
        self._lock: Lock = Lock()

    def open(self, directory: Path) -> Path:
        """
        Choose the folder the lines are written to.

        Args:
            directory: Folder of the service.

        Returns:
            The folder of the service.
        """
        with self._lock:
            self._close()
            self._directory = directory
        return directory

    def close(self) -> None:
        """Stop writing and release the file of the day."""
        with self._lock:
            self._close()
            self._directory = None

    def write(self, line: str) -> None:
        """
        Append a line to the file of today; a failure to write never stops the process.

        Args:
            line: Text of the line, without its line break.
        """
        with self._lock:
            if self._directory is None:
                return
            now: datetime = datetime.now()
            day: str = now.strftime(DAY_FORMAT)
            try:
                if day != self._day or self._handle is None:
                    self._close()
                    folder: Path = self._directory / now.strftime(MONTH_FORMAT)
                    folder.mkdir(parents=True, exist_ok=True)
                    self._handle = open(folder / f"{day}.log", "a", encoding="utf-8")
                    self._day = day
                self._handle.write(ANSI_PATTERN.sub("", line) + "\n")
                self._handle.flush()
            except OSError:
                self._handle = None
                self._day = ""

    def _close(self) -> None:
        """Close the open file, if any; the caller holds the lock."""
        if self._handle is not None:
            try:
                self._handle.close()
            except OSError:
                pass
        self._handle = None
        self._day = ""


_daily_file: _DailyFile = _DailyFile()


def write_line(line: str) -> None:
    """
    Append a line to the log file of the service, when it has one.

    Args:
        line: Text of the line; console colors are removed.
    """
    _daily_file.write(line)


def close_service_logs() -> None:
    """Stop writing log files and release the open file."""
    _daily_file.close()


class DailyFileHandler(logging.Handler):
    """Handler of the standard `logging` module that appends to the log file of the service."""

    def emit(self, record: logging.LogRecord) -> None:
        """
        Append a record to the file of today.

        Args:
            record: Record to write.
        """
        try:
            write_line(self.format(record))
        except Exception:
            self.handleError(record)


class HealthCheckFilter(logging.Filter):
    """Drops the access log lines of the health checks that succeeded."""

    def filter(self, record: logging.LogRecord) -> bool:
        """
        Tell whether a record is kept.

        Args:
            record: Access log record.

        Returns:
            False for a health check answered with 200.
        """
        try:
            return HEALTH_PATTERN.search(record.getMessage()) is None
        except Exception:
            return True


def setup_service_logs(service: str, base_dir: Path, configure_logging: bool = True) -> Path:
    """
    Send the logs of this process to the folder of its service.

    Args:
        service: Name of the service, which is the name of its folder.
        base_dir: Folder that holds the folders of every service.
        configure_logging: Also send the records of the standard `logging` module to the console and
            to the file; False for a process whose server configures `logging` itself.

    Returns:
        The folder of the service.
    """
    directory: Path = _daily_file.open(base_dir / service)
    for name in ACCESS_LOGGERS:
        access: logging.Logger = logging.getLogger(name)
        if not any(isinstance(existing, HealthCheckFilter) for existing in access.filters):
            access.addFilter(HealthCheckFilter())
    if configure_logging:
        formatter: logging.Formatter = logging.Formatter(RECORD_FORMAT)
        file_handler: DailyFileHandler = DailyFileHandler()
        file_handler.setFormatter(formatter)
        console_handler: logging.StreamHandler[Any] = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        logging.basicConfig(level=logging.INFO, handlers=[file_handler, console_handler], force=True)
    return directory


def uvicorn_log_config() -> dict[str, Any]:
    """
    Build the logging configuration of uvicorn with the log file of the service added.

    Returns:
        The default configuration of uvicorn, whose loggers also write to the file of today.
    """
    config: dict[str, Any] = copy.deepcopy(LOGGING_CONFIG)
    config["formatters"]["file"] = {"format": RECORD_FORMAT}
    config["handlers"]["file"] = {"()": "app.core.log_files.DailyFileHandler", "formatter": "file"}
    config["filters"] = {"health": {"()": "app.core.log_files.HealthCheckFilter"}}
    for name, logger in config["loggers"].items():
        handlers: list[str] = list(logger.get("handlers", []))
        if handlers:
            logger["handlers"] = [*handlers, "file"]
        if name == "uvicorn.access":
            logger["filters"] = ["health"]
    return config
