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

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize environment variables on startup"""
    logger.info("Initializing environment variables")
    await set_local_variables()
    yield

def crear_app() -> FastAPI:
    """
    Arma la app. Acá se eligen las implementaciones: con DATABASE_URL, cada móvil se
    guarda en Postgres; sin ella, vive en memoria. Con ENTRA_TENANT_ID y ENTRA_CLIENT_ID,
    se inicia sesión con Entra ID; sin ellas, un planner de prueba (desarrollo). Los tests
    arman su propia app, en memoria.
    """
    if environ.get("IS_LOCAL", "true").lower() == "false":
        nueva = FastAPI(lifespan=lifespan)
    else:
        nueva = FastAPI()
    nueva.middleware('http')(catch_exceptions)
    url = environ.get("DATABASE_URL")
    nueva.state.repositorio = Repositorio(Almacen(url) if url else None)
    tenant, cliente = environ.get("ENTRA_TENANT_ID"), environ.get("ENTRA_CLIENT_ID")
    nueva.state.autenticacion = ProveedorEntra(tenant, cliente) if tenant and cliente else ProveedorLocal()
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
        reload=environ.get("IS_LOCAL", "true").lower() == "true",
    )
