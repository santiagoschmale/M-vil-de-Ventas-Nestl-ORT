from fastapi import Request, Response
from src.config.logger import logger


async def catch_exceptions(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        # El detalle va al log, nunca al cliente: puede tener datos internos.
        logger.exception(msg=str(e))
        return Response("Internal server error", status_code=500)
