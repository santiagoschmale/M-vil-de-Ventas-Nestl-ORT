"""
Arranque de la API: con qué base y qué login queda según las variables. Fuera de local se
eligen después de cargar Key Vault, y sin Entra la API no arranca.
"""

import os
import unittest
from contextlib import contextmanager
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app import app, crear_app, es_local
from src.auth.proveedor import ProveedorEntra, ProveedorLocal
from src.config.logger import logger

ENTRA = {"ENTRA_TENANT_ID": "tenant-de-prueba", "ENTRA_CLIENT_ID": "app-de-prueba"}
VARIABLES = ("IS_LOCAL", "ENTRA_TENANT_ID", "ENTRA_CLIENT_ID", "PERMITIR_SIN_LOGIN", "DATABASE_URL")


@contextmanager
def _entorno(**variables):
    """Solo las variables dadas; las demás, sin definir (como un contenedor al que le falta configuración)."""
    antes = {v: os.environ.pop(v, None) for v in VARIABLES}
    os.environ.update(variables)
    try:
        yield
    finally:
        for v in VARIABLES:
            os.environ.pop(v, None)
            if antes[v] is not None:
                os.environ[v] = antes[v]


def _sin_key_vault():
    return patch("app.set_local_variables", new=AsyncMock())


class TestApp(unittest.TestCase):
    def setUp(self):
        """Set up test client for the app"""
        self.client = TestClient(app)

    def test_app_configuration(self):
        """Test that the app is configured correctly"""
        # Check if lifespan is configured (not direct comparison)
        self.assertIsNotNone(app.router.lifespan_context)

        # Check if middleware is registered
        self.assertTrue(len(app.user_middleware) > 0)

        # Check if health router is included
        # Con FastAPI >= 0.13x los routers incluidos no exponen .path: se mira el OpenAPI.
        self.assertIn("/health", app.openapi()["paths"])

    def test_health_endpoint(self):
        """Test that the health endpoint returns the expected response"""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), "OK")

    def test_is_local_vale_false_si_no_esta_definida(self):
        with _entorno():
            self.assertFalse(es_local())
        with _entorno(IS_LOCAL="false"):
            self.assertFalse(es_local())
        with _entorno(IS_LOCAL="true"):
            self.assertTrue(es_local())
        with _entorno(IS_LOCAL="True"):
            self.assertTrue(es_local())

    def test_lifespan(self):
        """Fuera de local, al arrancar primero se cargan las variables (Key Vault) y recién después se elige el login."""
        key_vault = AsyncMock(side_effect=lambda: os.environ.update(ENTRA))
        with _entorno(), patch("app.set_local_variables", new=key_vault):
            nueva = crear_app()
            self.assertIsInstance(nueva.state.autenticacion, ProveedorLocal)  # antes de arrancar no hay Entra
            with TestClient(nueva) as c:
                key_vault.assert_awaited_once()
                self.assertIsInstance(nueva.state.autenticacion, ProveedorEntra)
                self.assertEqual(c.get("/api/config").json()["entra"],
                                 {"tenant": ENTRA["ENTRA_TENANT_ID"], "client_id": ENTRA["ENTRA_CLIENT_ID"]})

    def test_fuera_de_local_sin_entra_la_api_no_arranca(self):
        with _entorno(), _sin_key_vault():
            with self.assertRaises(RuntimeError) as error:
                with TestClient(crear_app()):
                    pass
        self.assertIn("ENTRA_TENANT_ID", str(error.exception))

    def test_un_entorno_de_prueba_sin_login_lo_pide_a_proposito_y_queda_en_el_log(self):
        with _entorno(PERMITIR_SIN_LOGIN="true"), _sin_key_vault():
            with self.assertLogs(logger, level="WARNING") as registro:
                with TestClient(crear_app()) as c:
                    self.assertIsInstance(c.app.state.autenticacion, ProveedorLocal)
                    self.assertEqual(c.get("/api/whoami").json()["roles"], ["Admin"])
        self.assertTrue(any("PERMITIR_SIN_LOGIN" in linea for linea in registro.output), registro.output)

    def test_en_local_arranca_sin_entra_y_sin_key_vault(self):
        with _entorno(IS_LOCAL="true"), _sin_key_vault() as key_vault:
            with TestClient(crear_app()) as c:
                self.assertIsInstance(c.app.state.autenticacion, ProveedorLocal)
                self.assertEqual(c.get("/api/whoami").json()["roles"], ["Admin"])
            key_vault.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
