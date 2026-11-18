from unittest.mock import patch

# app.py arma la app al importarse y, sin Entra, avisa que no hay login: en los tests es ruido.
# Que el aviso salga se prueba en test_app.
with patch("src.config.logger.logger.warning"):
    import app  # noqa: F401
