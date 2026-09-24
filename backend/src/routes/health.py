from fastapi import APIRouter, status
from src.config.logger import logger

router = APIRouter()

@router.get('/health', tags=["Health"], status_code=status.HTTP_200_OK)
async def get_health() -> str:
    """Health check endpoint"""
    logger.info("Health endpoint was called")
    return 'OK'