import uvicorn
from fastapi import FastAPI
from logging import getLogger
from os import environ

from src.routes import health
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

if environ.get("IS_LOCAL", "true").lower() == "false":
    app = FastAPI(lifespan=lifespan)
else:
    app = FastAPI()

getLogger("uvicorn.error").name =  '${{ values.name }}'
app.middleware('http')(catch_exceptions)

app.include_router(health.router)

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=3000
    )
