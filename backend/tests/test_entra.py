"""
Login con Entra ID: el backend valida el token de cada pedido. Los tokens de estos tests
los firma una clave generada acá, en lugar de Microsoft.
"""

import time
from types import SimpleNamespace

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.auth.proveedor import ProveedorEntra, ProveedorLocal
from src.movil.repositorio import Repositorio
from src.routes import cuenta, movil
from fastapi import Depends

TENANT, CLIENTE = "tenant-de-prueba", "app-de-prueba"
CLAVE = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTRA = rsa.generate_private_key(public_exponent=65537, key_size=2048)


class _Claves:
    """Hace de PyJWKClient: siempre la clave pública de CLAVE."""

    def get_signing_key_from_jwt(self, token):
        return SimpleNamespace(key=CLAVE.public_key())


def _token(clave=CLAVE, **cambios):
    claims = {"iss": f"https://login.microsoftonline.com/{TENANT}/v2.0", "aud": CLIENTE, "exp": int(time.time()) + 600,
              "name": "Ana Prueba", "preferred_username": "ana.prueba@nestle.test", "oid": "1", "roles": ["Planner"],
              "scp": "access_as_user"}
    claims.update(cambios)
    return jwt.encode({k: v for k, v in claims.items() if v is not None}, clave, algorithm="RS256")


def _cliente(proveedor):
    app = FastAPI()
    app.state.repositorio = Repositorio()
    app.state.autenticacion = proveedor
    app.include_router(cuenta.router)
    app.include_router(movil.router, dependencies=[Depends(movil.autor)])
    return TestClient(app)


def _entra():
    return _cliente(ProveedorEntra(TENANT, CLIENTE, claves=_Claves()))


def _con(token):
    return {"Authorization": f"Bearer {token}"}


def test_sin_entra_configurado_la_pantalla_no_pide_login():
    c = _cliente(ProveedorLocal())
    assert c.get("/api/config").json()["entra"] is None
    assert c.get("/api/whoami").json()["username"] == "usuario-prueba"
    assert c.get("/api/movil").status_code == 200


def test_con_entra_la_pantalla_sabe_con_que_app_iniciar_sesion():
    assert _entra().get("/api/config").json()["entra"] == {"tenant": TENANT, "client_id": CLIENTE}


def test_sin_token_no_se_ve_el_movil():
    r = _entra().get("/api/movil")
    assert r.status_code == 401 and "Iniciá sesión" in r.json()["detail"]


def test_con_un_token_valido_entra_y_el_historial_guarda_quien_fue():
    c = _entra()
    assert c.get("/api/whoami", headers=_con(_token())).json() == {
        "name": "Ana Prueba", "username": "ana.prueba@nestle.test", "roles": ["Planner"]}
    assert c.get("/api/movil", headers=_con(_token())).status_code == 200
    r = c.post("/api/movil/muestra", headers=_con(_token()))
    assert r.json()["historial"][-1]["autor"] == "ana.prueba@nestle.test"


def test_tambien_acepta_el_token_pedido_para_la_api_y_los_tokens_v1():
    c = _entra()
    assert c.get("/api/whoami", headers=_con(_token(aud=f"api://{CLIENTE}"))).status_code == 200
    assert c.get("/api/whoami", headers=_con(_token(iss=f"https://sts.windows.net/{TENANT}/"))).status_code == 200


def test_rechaza_tokens_vencidos_ajenos_o_de_otra_app():
    c = _entra()
    for token in (_token(exp=int(time.time()) - 10), _token(clave=OTRA), _token(aud="otra-app"),
                  _token(iss="https://login.microsoftonline.com/otro-tenant/v2.0"), "no-es-un-token"):
        assert c.get("/api/whoami", headers=_con(token)).status_code == 401, token


def test_sin_el_rol_no_entra():
    r = _entra().get("/api/movil", headers=_con(_token(roles=None)))
    assert r.status_code == 403 and "rol Planner" in r.json()["detail"]


def test_un_token_de_identidad_no_sirve_para_la_api():
    """El token de identidad también es para nuestra app, pero no trae el permiso de la API."""
    assert _entra().get("/api/whoami", headers=_con(_token(scp=None))).status_code == 401


def test_empezar_de_cero_solo_lo_hace_un_admin():
    import os
    antes = os.environ.get("PERMITIR_REINICIAR")
    os.environ["PERMITIR_REINICIAR"] = "true"
    try:
        c = _entra()
        r = c.post("/api/movil/reiniciar", headers=_con(_token()))
        assert r.status_code == 403 and "Admin" in r.json()["detail"]
        assert c.post("/api/movil/reiniciar", headers=_con(_token(roles=["Admin"]))).status_code == 200
    finally:
        if antes is None:
            os.environ.pop("PERMITIR_REINICIAR", None)
        else:
            os.environ["PERMITIR_REINICIAR"] = antes
