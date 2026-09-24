import uvicorn
from fastapi import FastAPI
from logging import getLogger
from os import environ

from src.auth.proveedor import ProveedorLocal
from src.movil.repositorio import RepositorioEnMemoria
from src.routes import health, movil
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
    Arma la app. Acá se eligen las implementaciones: sesión en memoria y
    autenticación local; cambiar a Postgres o a Entra ID es cambiar estas líneas.
    Los tests arman su propia app con una sesión vacía.
    """
    if environ.get("IS_LOCAL", "true").lower() == "false":
        nueva = FastAPI(lifespan=lifespan)
    else:
        nueva = FastAPI()
    nueva.middleware('http')(catch_exceptions)
    nueva.state.repositorio = RepositorioEnMemoria()
    nueva.state.autenticacion = ProveedorLocal()
    nueva.include_router(health.router)
    nueva.include_router(movil.router)
    return nueva


app = crear_app()
getLogger("uvicorn.error").name =  '${{ values.name }}'

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=3000
    )
