"""Tests of the verbosity filters and the daily log files."""

# Standard library
from __future__ import annotations
from datetime import datetime
from pathlib import Path

# Third-party
import pytest

# Project imports
from app.core.log_files import close_service_logs, setup_service_logs
from app.core.logging import ConsoleLogger, LogLevel, SuppressionRules


def test_suppression_rules_parse_levels_and_pairs() -> None:
    """Plain entries silence a level and `LEVEL:N` entries silence one verbosity; junk is ignored."""
    rules: SuppressionRules = SuppressionRules.parse("DEBUG:3, success,unknown,INFO:x")
    assert rules.levels == frozenset({LogLevel.SUCCESS})
    assert rules.pairs == frozenset({(LogLevel.DEBUG, 3)})


def test_logger_filters_by_level_verbosity_and_suppression() -> None:
    """A line passes only when its level, verbosity and suppression rules allow it."""
    logger: ConsoleLogger = ConsoleLogger()
    logger.configure("DEBUG", 3, "DEBUG:2,SUCCESS")
    assert logger.is_enabled(LogLevel.DEBUG, 1)
    assert not logger.is_enabled(LogLevel.DEBUG, 2)
    assert logger.is_enabled(LogLevel.DEBUG, 3)
    assert not logger.is_enabled(LogLevel.DEBUG, 4)
    assert not logger.is_enabled(LogLevel.SUCCESS, 1)
    logger.configure("WARNING", 1, "")
    assert not logger.is_enabled(LogLevel.INFO, 1)
    assert logger.is_enabled(LogLevel.ERROR, 1)


def test_log_lines_are_written_to_daily_file(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    """Printed lines are copied without colors to `<service>/<YYYY-MM>/<YYYY-MM-DD>.log`."""
    logger: ConsoleLogger = ConsoleLogger()
    logger.configure("DEBUG", 2, "")
    setup_service_logs("business-api", tmp_path, configure_logging=False)
    try:
        logger.log("INFO", "service started")
        logger.log("DEBUG", "query details", verbosity=2)
        logger.log("DEBUG", "hidden", verbosity=3)
    finally:
        close_service_logs()
    now: datetime = datetime.now()
    file: Path = tmp_path / "business-api" / now.strftime("%Y-%m") / f"{now.strftime('%Y-%m-%d')}.log"
    content: str = file.read_text(encoding="utf-8")
    assert "[INFO] service started" in content
    assert "[DEBUG:2] query details" in content
    assert "hidden" not in content
    assert "\x1b[" not in content
    assert "service started" in capsys.readouterr().out
