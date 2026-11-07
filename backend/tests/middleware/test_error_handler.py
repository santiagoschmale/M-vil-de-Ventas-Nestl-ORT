"""El manejador de errores del template: responde 500 sin filtrar el detalle interno."""

import asyncio
import unittest

from src.config.logger import logger
from src.middleware.error_handler import catch_exceptions


class TestErrorHandler(unittest.TestCase):
    def test_el_manejador_responde_500_y_no_explota(self):
        async def rompe(_request):
            raise RuntimeError("contraseña=1234 en la cadena de conexión")

        # Si el manejador tiene un bug, esto lanza en vez de devolver una respuesta.
        with self.assertLogs(logger, "ERROR") as log:
            respuesta = asyncio.run(catch_exceptions(None, rompe))
        self.assertIn("contraseña=1234", log.output[0])  # al log sí va
        self.assertEqual(respuesta.status_code, 500)
        self.assertNotIn(b"contrase", respuesta.body)
