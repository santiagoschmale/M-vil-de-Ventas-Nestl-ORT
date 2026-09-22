from io import BytesIO

from fastapi import APIRouter, Depends, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import excel_service

router = APIRouter(prefix="/excel", tags=["excel"])


@router.get("/exportar/{periodo}")
def exportar(periodo: str, db: Session = Depends(get_db)):
    buffer = excel_service.exportar_participacion_a_excel(db, periodo)
    filename = f"participacion_{periodo}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/importar/{periodo}")
async def importar(periodo: str, archivo: UploadFile, db: Session = Depends(get_db)):
    contenido = await archivo.read()
    cantidad = excel_service.importar_participacion_desde_excel(
        db, periodo, BytesIO(contenido)
    )
    return {"filas_insertadas": cantidad}
