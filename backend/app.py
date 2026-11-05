import uvicorn
from fastapi import FastAPI
from logging import getLogger
from os import environ

from fastapi import Depends

from src.auth.proveedor import ProveedorEntra, ProveedorLocal
from src.movil.almacen import Almacen
from src.movil.repositorio import Repositorio
from src.routes import cuenta, health, movil
from nbra_envs_python import set_local_variables
from src.config.logger import logger
from src.middleware.error_handler import catch_exceptions
from contextlib import asynccontextmanager

logger.info("Starting backend application")


def es_local() -> bool:
    """
    IS_LOCAL=true, explícito, es desarrollo: recarga automática, sin Key Vault, sin login y con
    "Empezar de cero". Sin definir, la API se comporta como en un contenedor: nunca es local por accidente.
    """
    return environ.get("IS_LOCAL", "false").lower() == "true"


def _pedido(variable: str) -> bool:
    return environ.get(variable, "").lower() == "true"


def elegir_login(estricto: bool):
    """
    Con ENTRA_TENANT_ID y ENTRA_CLIENT_ID, se inicia sesión con Entra ID. Sin ellas, un planner de prueba
    con rol Admin y sin login: vale en local, o en un entorno de prueba que lo pide a propósito con
    PERMITIR_SIN_LOGIN=true (y queda en el log). En cualquier otro caso, con `estricto` la API no arranca:
    una variable que falta en un deploy no puede dejarla abierta.
    """
    tenant, cliente = environ.get("ENTRA_TENANT_ID"), environ.get("ENTRA_CLIENT_ID")
    if tenant and cliente:
        return ProveedorEntra(tenant, cliente)
    if es_local():
        return ProveedorLocal()
    if _pedido("PERMITIR_SIN_LOGIN"):
        logger.warning("PERMITIR_SIN_LOGIN=true: sin ENTRA_TENANT_ID y ENTRA_CLIENT_ID no hay login y cualquiera que "
                       "llegue a la API la usa como Admin. Solo para un entorno de prueba detrás de otro control de "
                       "acceso.")
        return ProveedorLocal()
    if estricto:
        raise RuntimeError("Sin ENTRA_TENANT_ID y ENTRA_CLIENT_ID no hay login: la API no arranca. Para un entorno de "
                           "prueba sin login, PERMITIR_SIN_LOGIN=true, a propósito.")
    return ProveedorLocal()


def configurar(app: FastAPI, estricto: bool) -> None:
    """Elige la base y el login con las variables de entorno que hay en este momento."""
    url = environ.get("DATABASE_URL")
    if estricto and not url:
        logger.warning("Sin DATABASE_URL: cada móvil vive en memoria y se pierde al reiniciar la API.")
    app.state.repositorio = Repositorio(Almacen(url) if url else None)
    app.state.autenticacion = elegir_login(estricto)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Fuera de local: primero las variables de Key Vault y recién después se eligen la base y el login."""
    logger.info("Initializing environment variables")
    await set_local_variables()
    configurar(app, estricto=True)
    yield


def crear_app() -> FastAPI:
    """
    Arma la app. En local, la base y el login se eligen acá, con las variables de entorno: con
    DATABASE_URL, cada móvil se guarda en Postgres; sin ella, vive en memoria. Fuera de local se eligen
    al arrancar (lifespan), después de cargar Key Vault, y sin Entra la API no arranca; hasta ese momento
    la app queda con lo que haya en el entorno, para los tests, que la arman sin arrancarla.
    """
    if es_local():
        nueva = FastAPI()
    else:
        nueva = FastAPI(lifespan=lifespan)
    nueva.middleware('http')(catch_exceptions)
    configurar(nueva, estricto=False)
    nueva.include_router(health.router)
    nueva.include_router(cuenta.router)
    # Todo el móvil pide sesión, también lo que solo lee: con Entra, sin token no se ve nada.
    nueva.include_router(movil.router, dependencies=[Depends(movil.autor)])
    return nueva


app = crear_app()
getLogger("uvicorn.error").name =  '${{ values.name }}'

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=3000,
        # En local se reinicia solo al cambiar el código (la sesión en memoria se pierde con cada reinicio).
        reload=es_local(),
    )
