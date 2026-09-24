"""
API del móvil: cargar las entradas, ver el estado y las inconsistencias, apagar SKUs
y entidades, fijar celdas y exportar.

Los montos viajan como texto ("1234.500"), nunca como número JSON: un número JSON
pasa por float en JavaScript. El front muestra, el backend calcula.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from src.domain.cruce import Inconsistencia, ResultadoCruce
from src.movil.recorrido import exportar
from src.movil.sesion import UNIDADES as DECIMALES, Ajuste, ErrorDeAjuste, Sesion

router = APIRouter(prefix="/api/movil", tags=["Móvil"])
# Canales y entidades van al final de la ruta con :path: un nombre real puede tener "/".

MUESTRA = Path(__file__).resolve().parents[3] / "data" / "sample"
TAMANO_MAXIMO = 20 * 1024 * 1024


# ---------------------------------------------------------------------------
# Dependencias
# ---------------------------------------------------------------------------

def sesion(request: Request):
    with request.app.state.repositorio.usar() as s:
        yield s


def autor(request: Request) -> str:
    return request.app.state.autenticacion.usuario_actual(request)


def _ahora() -> datetime:
    return datetime.now().astimezone()


def _aplicar(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except ErrorDeAjuste as e:
        raise HTTPException(422, str(e)) from e


# ---------------------------------------------------------------------------
# Esquemas
# ---------------------------------------------------------------------------

class TextoIn(BaseModel):
    texto: str = Field(description="La tabla del input 2 tal como se pega desde Excel")


class ActivoIn(BaseModel):
    activo: bool
    motivo: str = Field(description="Obligatorio: queda en el historial")


class FijarIn(BaseModel):
    monto: str = Field(description="Decimal como texto: '1234.5' o '1.234,5'", examples=["1234.5"])
    motivo: str


class MotivoIn(BaseModel):
    motivo: str


def _texto(v: Decimal | None, unidad: str) -> str | None:
    return None if v is None else str(v.quantize(Decimal(1).scaleb(-DECIMALES[unidad])))


def _suma(valores) -> Decimal:
    return sum(valores, Decimal(0))


def _inconsistencia(i: Inconsistencia) -> dict:
    return {"tipo": i.tipo, "mensaje": i.mensaje, "skus": list(i.skus), "canales": list(i.canales),
            "diferencia": None if i.diferencia is None else str(i.diferencia)}


def _ajuste(a: Ajuste) -> dict:
    return {"accion": a.accion, "detalle": a.detalle, "autor": a.autor, "cuando": a.cuando.isoformat(),
            "motivo": a.motivo}


def _cierra(c: ResultadoCruce | None) -> bool:
    return c is not None and c.celdas is not None


def _estado(s: Sesion) -> dict:
    e, r = s.entradas, s.recorrido
    input1 = input2 = base = None
    if e.objetivos is not None:
        activos = [o for k, o in e.objetivos.items() if k not in s.apagados_skus]
        input1 = {"archivo": e.archivo1, "skus": len(e.objetivos),
                  "kilos": _texto(_suma(o.kilos for o in activos), "kilos"),
                  "nns": _texto(_suma(o.nns or 0 for o in activos), "plata")}
    if e.canales is not None:
        input2 = {"canales": len(e.canales), "texto": e.texto2,
                  "kilos": _texto(_suma(t.kilos for t in e.canales.values()), "kilos"),
                  "plata": _texto(_suma(t.plata or 0 for t in e.canales.values()), "plata")}
    if e.base is not None:
        base = {"archivo": e.archivo_base, "celdas": len(e.base), "aperturas": len(e.apertura)}
    cruces = {"kilos": r.kilos if r else None, "plata": r.plata if r else None}
    return {
        "faltan": s.faltan(),
        "entradas": {"input1": input1, "input2": input2, "base": base},
        "cierra": {u: _cierra(c) for u, c in cruces.items()},
        "inconsistencias": {u: [_inconsistencia(i) for i in (c.inconsistencias if c else [])]
                            for u, c in cruces.items()},
        "avisos": {u: list(c.avisos) if c else [] for u, c in cruces.items()},
        "problemas": [{"severidad": p.severidad, "mensaje": p.mensaje, "sku": p.sku, "bloque": p.bloque}
                      for p in (r.problemas if r else e.problemas1 + e.problemas2 + e.problemas_base)],
        "apagados": {
            "skus": [{"codigo": k, **_ajuste(a)} for k, a in sorted(s.apagados_skus.items())],
            "entidades": [{"nombre": k, **_ajuste(a)} for k, a in sorted(s.entidades_apagadas.items())],
        },
        "fijas": {u: [{"sku": k[0], "canal": k[1], "valor": _texto(f.valor, u), **_ajuste(f.ajuste)}
                      for k, f in sorted(s.fijas(u).items())] for u in DECIMALES},
        "historial": [_ajuste(a) for a in s.historial],
    }


# ---------------------------------------------------------------------------
# Entradas
# ---------------------------------------------------------------------------

def _archivo(archivo: UploadFile) -> BytesIO:
    datos = archivo.file.read(TAMANO_MAXIMO + 1)
    if len(datos) > TAMANO_MAXIMO:
        raise HTTPException(413, "El archivo supera los 20 MB.")
    return BytesIO(datos)


@router.get("", summary="Estado del móvil: entradas, si cierra, inconsistencias, ajustes e historial")
def obtener_estado(s: Sesion = Depends(sesion)):
    return _estado(s)


@router.post("/input1", summary="Cargar el input 1 (Excel de Contraloría)")
def cargar_input1(archivo: UploadFile = File(...), s: Sesion = Depends(sesion), quien: str = Depends(autor)):
    _aplicar(s.cargar_input1, _archivo(archivo), archivo.filename or "input1.xlsx", quien, _ahora())
    return _estado(s)


@router.put("/input2", summary="Cargar el input 2 (tabla de totales por canal, pegada)")
def cargar_input2(cuerpo: TextoIn, s: Sesion = Depends(sesion), quien: str = Depends(autor)):
    _aplicar(s.cargar_input2, cuerpo.texto, quien, _ahora())
    return _estado(s)


@router.post("/base", summary="Cargar la base del mes anterior (Excel con reparto y apertura)")
def cargar_base(archivo: UploadFile = File(...), s: Sesion = Depends(sesion), quien: str = Depends(autor)):
    _aplicar(s.cargar_base, _archivo(archivo), archivo.filename or "base.xlsx", quien, _ahora())
    return _estado(s)


@router.post("/muestra", summary="Cargar las tres entradas de muestra (datos ficticios)")
def cargar_muestra(s: Sesion = Depends(sesion), quien: str = Depends(autor)):
    ahora = _ahora()
    _aplicar(s.cargar_input1, MUESTRA / "input1_objetivo.xlsx", "input1_objetivo.xlsx", quien, ahora)
    _aplicar(s.cargar_input2, (MUESTRA / "input2_canales.tsv").read_text(encoding="utf-8"), quien, ahora)
    _aplicar(s.cargar_base, MUESTRA / "base_mes_anterior.xlsx", "base_mes_anterior.xlsx", quien, ahora)
    return _estado(s)


# ---------------------------------------------------------------------------
# Resultado
# ---------------------------------------------------------------------------

def _exigir_recorrido(s: Sesion):
    if s.recorrido is None:
        raise HTTPException(409, f"Falta cargar: {', '.join(s.faltan())}.")
    return s.recorrido


@router.get("/cruce/{unidad}", summary="Matriz SKU × canal de una unidad (kilos o plata)")
def obtener_cruce(unidad: str, s: Sesion = Depends(sesion)):
    if unidad not in DECIMALES:
        raise HTTPException(422, "Unidad desconocida: usar kilos o plata.")
    r = _exigir_recorrido(s)
    cruce = r.kilos if unidad == "kilos" else r.plata
    celdas = cruce.celdas if cruce and cruce.celdas is not None else {}
    fijas = s.fijas(unidad)
    total_canal = {c: (t.kilos if unidad == "kilos" else t.plata) for c, t in r.canales.items()}
    return {
        "unidad": unidad,
        "cierra": _cierra(cruce),
        "canales": [
            {"nombre": c, "pedido": _texto(total_canal[c], unidad),
             "repartido": _texto(_suma(v for (_, k), v in celdas.items() if k == c), unidad)}
            for c in sorted(r.canales)
        ],
        "skus": [
            {
                "codigo": sku,
                "descripcion": o.descripcion,
                "objetivo": _texto(o.kilos if unidad == "kilos" else o.nns, unidad),
                "activo": sku not in s.apagados_skus,
                "celdas": {k: {"monto": _texto(v, unidad), "fijada": (sku, k) in fijas}
                           for (x, k), v in sorted(celdas.items()) if x == sku},
            }
            for sku, o in sorted(r.objetivos.items())
        ],
    }


@router.get("/apertura/{sku}/{canal:path}", summary="Cómo se abre una celda debajo del canal")
def obtener_apertura(sku: str, canal: str, s: Sesion = Depends(sesion)):
    r = _exigir_recorrido(s)
    raiz = r.aperturas.get((sku, canal))
    if raiz is None:
        raise HTTPException(404, f"{sku} × {canal} no se abre debajo del canal.")
    return {
        "sku": sku,
        "canal": canal,
        "kilos": _texto(raiz.valores["kilos"].monto, "kilos"),
        "plata": _texto(raiz.valores["nns"].monto, "plata"),
        "cuadra": {"kilos": raiz.cuadra["kilos"], "plata": raiz.cuadra["nns"]},
        "aviso": raiz.aviso["kilos"] or raiz.aviso["nns"],
        "entidades": [
            {"nombre": h.entidad, "activo": h.activo, "peso": str(h.peso),
             "kilos": _texto(h.valores["kilos"].monto, "kilos"), "plata": _texto(h.valores["nns"].monto, "plata")}
            for h in raiz.hijos
        ],
    }


@router.get("/exportar", summary="Excel del móvil: Kilos, Plata, Apertura y Problemas")
def exportar_excel(s: Sesion = Depends(sesion)):
    r = _exigir_recorrido(s)
    datos = BytesIO()
    exportar(r, datos)
    datos.seek(0)
    return StreamingResponse(
        datos,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="movil.xlsx"'},
    )


# ---------------------------------------------------------------------------
# Ajustes del planner (todos con motivo)
# ---------------------------------------------------------------------------

@router.put("/skus/{sku}", summary="Prender o apagar un SKU (ON/OFF)")
def cambiar_sku(sku: str, cuerpo: ActivoIn, s: Sesion = Depends(sesion), quien: str = Depends(autor)):
    _aplicar(s.cambiar_sku, sku, activo=cuerpo.activo, autor=quien, cuando=_ahora(), motivo=cuerpo.motivo)
    return _estado(s)


@router.put("/entidades/{entidad:path}", summary="Prender o apagar un distribuidor o vendedor (ON/OFF)")
def cambiar_entidad(entidad: str, cuerpo: ActivoIn, s: Sesion = Depends(sesion), quien: str = Depends(autor)):
    _aplicar(s.cambiar_entidad, entidad, activo=cuerpo.activo, autor=quien, cuando=_ahora(), motivo=cuerpo.motivo)
    return _estado(s)


@router.put("/celdas/{unidad}/{sku}/{canal:path}", summary="Fijar el valor de una celda SKU × canal")
def fijar_celda(unidad: str, sku: str, canal: str, cuerpo: FijarIn, s: Sesion = Depends(sesion),
                quien: str = Depends(autor)):
    _aplicar(s.fijar, unidad, sku, canal, cuerpo.monto, autor=quien, cuando=_ahora(), motivo=cuerpo.motivo)
    return _estado(s)


@router.delete("/celdas/{unidad}/{sku}/{canal:path}", summary="Volver una celda a calculada")
def desfijar_celda(unidad: str, sku: str, canal: str, cuerpo: MotivoIn, s: Sesion = Depends(sesion),
                   quien: str = Depends(autor)):
    _aplicar(s.desfijar, unidad, sku, canal, autor=quien, cuando=_ahora(), motivo=cuerpo.motivo)
    return _estado(s)
