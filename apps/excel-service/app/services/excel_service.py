from io import BytesIO

import pandas as pd
from sqlalchemy.orm import Session

from app.models.movil import Participacion


def exportar_participacion_a_excel(db: Session, periodo: str) -> BytesIO:
    """Arma un .xlsx con la participación cargada para un período.

    Sirve de plantilla para el resto de las exportaciones (ObjetivoTotal,
    histórico de MovilAprobado, etc): misma forma, distinta query.
    """
    filas = (
        db.query(Participacion)
        .filter(Participacion.periodo == periodo)
        .all()
    )

    df = pd.DataFrame(
        [
            {
                "sku_id": f.sku_id,
                "entidad_tipo": f.entidad_tipo,
                "entidad_id": f.entidad_id,
                "porcentaje": float(f.porcentaje),
                "origen": f.origen,
                "aprobado": f.aprobado,
            }
            for f in filas
        ]
    )

    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name=periodo, index=False)
    buffer.seek(0)
    return buffer


def importar_participacion_desde_excel(db: Session, periodo: str, archivo: BytesIO) -> int:
    """Lee un .xlsx con el mismo formato de exportar_participacion_a_excel
    y crea filas de Participacion nuevas (origen='manual').

    Devuelve la cantidad de filas insertadas. Validación de negocio
    (que la suma de porcentajes por padre dé 100%) queda para la capa
    de aplicación que llame a esto, no acá.
    """
    df = pd.read_excel(archivo)

    nuevas = [
        Participacion(
            sku_id=int(row["sku_id"]),
            periodo=periodo,
            entidad_tipo=str(row["entidad_tipo"]),
            entidad_id=int(row["entidad_id"]),
            porcentaje=float(row["porcentaje"]),
            origen="manual",
            aprobado=False,
        )
        for _, row in df.iterrows()
    ]

    db.add_all(nuevas)
    db.commit()
    return len(nuevas)
