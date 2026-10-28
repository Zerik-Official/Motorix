"""
Colored console logging with numeric verbosity, copied to the log file of the service.

Every line has a level and a verbosity (1 by default, higher means more detail). A line is
printed when its level reaches `LOG_LEVEL`, its verbosity does not exceed `LOG_VERBOSITY`
and it is not listed in `LOG_SUPPRESS`. `LOG_SUPPRESS` is a comma separated list where
`SUCCESS` silences a whole level and `DEBUG:3` silences only that verbosity of the level.
"""

# Standard library
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from enum import IntEnum
from typing import Final

# Third-party
from colorama import Fore, Style, just_fix_windows_console

# Project imports
from app.core.log_files import write_line

just_fix_windows_console()

TIME_FORMAT: Final[str] = "%Y-%m-%d %H:%M:%S"


class LogLevel(IntEnum):
    """Severity of a log line, ordered from least to most severe."""

    DEBUG = 10
    INFO = 20
    SUCCESS = 25
    WARNING = 30
    ERROR = 40
    CRITICAL = 50


LEVEL_COLORS: Final[dict[LogLevel, str]] = {
    LogLevel.DEBUG: Fore.MAGENTA,
    LogLevel.INFO: Fore.CYAN,
    LogLevel.SUCCESS: Fore.GREEN,
    LogLevel.WARNING: Fore.YELLOW,
    LogLevel.ERROR: Fore.RED,
    LogLevel.CRITICAL: Fore.LIGHTRED_EX + Style.BRIGHT,
}


def parse_level(name: str) -> LogLevel:
    """
    Convert a level name to its level.

    Args:
        name: Level name, case insensitive.

    Returns:
        The matching level, or INFO for an unknown name.
    """
    try:
        return LogLevel[name.strip().upper()]
    except KeyError:
        return LogLevel.INFO


@dataclass(frozen=True)
class SuppressionRules:
    """Levels and level/verbosity pairs that are never printed."""

    levels: frozenset[LogLevel] = field(default_factory=frozenset)
    pairs: frozenset[tuple[LogLevel, int]] = field(default_factory=frozenset)

    @classmethod
    def parse(cls, raw: str) -> SuppressionRules:
        """
        Build the rules from the `LOG_SUPPRESS` syntax, ignoring malformed entries.

        Args:
            raw: Comma separated entries such as `DEBUG:3,SUCCESS`.

        Returns:
            The parsed rules.
        """
        levels: set[LogLevel] = set()
        pairs: set[tuple[LogLevel, int]] = set()
        for entry in raw.split(","):
            name, _, verbosity = entry.strip().partition(":")
            if name.strip().upper() not in LogLevel.__members__:
                continue
            level: LogLevel = LogLevel[name.strip().upper()]
            if not verbosity:
                levels.add(level)
            elif verbosity.strip().isdigit():
                pairs.add((level, int(verbosity.strip())))
        return cls(levels=frozenset(levels), pairs=frozenset(pairs))

    def suppresses(self, level: LogLevel, verbosity: int) -> bool:
        """
        Tell whether a line is silenced.

        Args:
            level: Level of the line.
            verbosity: Verbosity of the line.

        Returns:
            True when the level or the exact level/verbosity pair is suppressed.
        """
        return level in self.levels or (level, verbosity) in self.pairs


class ConsoleLogger:
    """Prints filtered, timestamped and color-coded lines and copies them to the log file."""

    def __init__(self) -> None:
        """Start with INFO, verbosity 1 and nothing suppressed."""
        self._threshold: LogLevel = LogLevel.INFO
        self._max_verbosity: int = 1
        self._rules: SuppressionRules = SuppressionRules()

    def configure(self, level: str, verbosity: int, suppress: str) -> None:
        """
        Apply the filters of the service.

        Args:
            level: Minimum level printed.
            verbosity: Maximum verbosity printed.
            suppress: Entries in the `LOG_SUPPRESS` syntax.
        """
        self._threshold = parse_level(level)
        self._max_verbosity = max(1, verbosity)
        self._rules = SuppressionRules.parse(suppress)

    def is_enabled(self, level: LogLevel, verbosity: int = 1) -> bool:
        """
        Tell whether a line passes the filters.

        Args:
            level: Level of the line.
            verbosity: Verbosity of the line.

        Returns:
            True when the line would be printed.
        """
        return (
            level >= self._threshold
            and verbosity <= self._max_verbosity
            and not self._rules.suppresses(level, verbosity)
        )

    def log(self, level: str | LogLevel, message: str, verbosity: int = 1) -> None:
        """
        Print a line to stdout and append it, without colors, to the log file of the service.

        Args:
            level: Level of the line (DEBUG, INFO, SUCCESS, WARNING, ERROR or CRITICAL).
            message: Text to print.
            verbosity: Detail of the line, 1 for the most relevant.
        """
        resolved: LogLevel = level if isinstance(level, LogLevel) else parse_level(level)
        if not self.is_enabled(resolved, verbosity):
            return
        timestamp: str = datetime.now().strftime(TIME_FORMAT)
        label: str = resolved.name if verbosity == 1 else f"{resolved.name}:{verbosity}"
        color: str = LEVEL_COLORS[resolved]
        print(f"{Style.DIM}{timestamp}{Style.RESET_ALL} [{color}{label}{Style.RESET_ALL}] {message}", flush=True)
        write_line(f"{timestamp} [{label}] {message}")


logger: ConsoleLogger = ConsoleLogger()


def configure_logging(level: str, verbosity: int, suppress: str) -> None:
    """
    Apply the filters of the service to the shared logger.

    Args:
        level: Minimum level printed.
        verbosity: Maximum verbosity printed.
        suppress: Entries in the `LOG_SUPPRESS` syntax.
    """
    logger.configure(level, verbosity, suppress)


def log(level: str | LogLevel, message: str, verbosity: int = 1) -> None:
    """
    Print a line through the shared logger.

    Args:
        level: Level of the line.
        message: Text to print.
        verbosity: Detail of the line, 1 for the most relevant.
    """
    logger.log(level, message, verbosity)
