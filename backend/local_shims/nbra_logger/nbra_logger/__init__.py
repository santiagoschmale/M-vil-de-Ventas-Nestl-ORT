"""Reemplazo local de nbra-logger-py: un logger estándar a stdout."""

import logging
import sys


def build_nbra_logger(application_name: str) -> logging.Logger:
    logger = logging.getLogger(application_name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
        )
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger
