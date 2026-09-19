from fastapi import FastAPI

from app.routers.excel_router import router as excel_router

app = FastAPI(title="Motor de Ventas — Excel Service")

app.include_router(excel_router)


@app.get("/health")
def health():
    return {"status": "ok"}
