"""Logging utilities – rich console + rotating file log."""
import logging
import os
from logging.handlers import RotatingFileHandler

from rich.logging import RichHandler

_LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output", "logs")
os.makedirs(_LOG_DIR, exist_ok=True)

_LOG_FILE = os.path.join(_LOG_DIR, "scraper.log")

_configured = False


def get_logger(name: str) -> logging.Logger:
    global _configured
    if not _configured:
        root = logging.getLogger()
        root.setLevel(logging.DEBUG)

        # Rich console handler (INFO and above)
        console = RichHandler(rich_tracebacks=True, markup=True, show_path=False)
        console.setLevel(logging.INFO)
        root.addHandler(console)

        # Rotating file handler (DEBUG and above)
        file_handler = RotatingFileHandler(
            _LOG_FILE, maxBytes=10 * 1024 * 1024, backupCount=3, encoding="utf-8"
        )
        file_handler.setLevel(logging.DEBUG)
        fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
        file_handler.setFormatter(fmt)
        root.addHandler(file_handler)

        _configured = True

    return logging.getLogger(name)
