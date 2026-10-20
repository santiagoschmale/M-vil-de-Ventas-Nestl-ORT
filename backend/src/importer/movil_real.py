"""
El móvil como lo arma hoy el planner: un solo Excel (.xlsb) con las hojas Móvil Mes,
Participaciones, Ingredientes, Soluciones y Distribuidores (`entendimiento-negocio.md` §15).

Cada hoja es una o más tablas por bloques: una fila de títulos (el canal, el distribuidor
o el asesor) y debajo, en cada bloque, "Kgs | NNS | NNS C/IIBB" por SKU. Se lee por esos
títulos y encabezados, nunca por posición.

Como mes anterior:
- el reparto por canal sale de la primera tabla de Ingredientes y de Soluciones;
- la apertura de Distribuidores, de la hoja Distribuidores;
- la apertura del Call Center, de la tabla de asesores de Soluciones.
ponytail: qué canal abre cada tabla está fijo acá mientras la estructura de Soluciones
siga abierta (A17). Si cambia, cambia este mapeo, no el resto.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from src.domain.problema import Problema

HOJAS = ("ingredientes", "soluciones", "distribuidores")
_KILOS = {"kgs", "kg", "suma de kg"}
_NNS = {"nns", "suma de nns"}
_NO_SON_BLOQUES = ("totales", "diferencia", "check", "precio")
CALL_CENTER, DISTRIBUIDORES = "Call Center", "Distribuidores"


@dataclass
class Tabla:
    """Una tabla por bloques: {sku: {título: (kilos, nns)}}, en el orden de los títulos."""
    titulos: list[str]
    filas: dict[str, dict[str, tuple[Decimal | None, Decimal | None]]] = field(default_factory=dict)


def _norm(valor) -> str:
    from src.importer.entradas import normalizar
    return normalizar(valor) if isinstance(valor, str) else ""


def tablas(filas: list[list]) -> list[Tabla]:
    """Todas las tablas por bloques de una hoja, de arriba hacia abajo."""
    from src.importer.entradas import _celda, _codigo
    encontradas = []
    i = 0
    while i < len(filas):
        fila = filas[i]
        col_sku = next((j for j, v in enumerate(fila) if _norm(v) == "sku"), None)
        # Algunas tablas de Participaciones no rotulan la columna del SKU: el encabezado tiene
        # "Kgs" y la fila de abajo arranca con un código en la segunda columna.
        if col_sku is None and any(_norm(v) in _KILOS for v in fila) and i + 1 < len(filas) \
                and len(filas[i + 1]) > 1 and (_codigo(filas[i + 1][1]) or "").isdigit():
            col_sku = 1
        if col_sku is None:
            i += 1
            continue
        # Los títulos están en la fila no vacía más cercana arriba del encabezado.
        arriba = next((filas[k] for k in range(i - 1, max(i - 4, -1), -1) if any(v not in (None, "") for v in filas[k])), [])
        bloques: dict[str, tuple[int, int | None]] = {}
        for j, v in enumerate(fila):
            if _norm(v) not in _KILOS or j <= col_sku + 1:
                continue
            # El título va al principio del bloque (o en cada columna, en la de asesores). Sin título
            # cerca, es el total del SKU de las primeras columnas: no es un bloque.
            titulo = next((str(arriba[k]).strip() for k in (j, j - 1, j - 2)
                           if col_sku + 1 < k < len(arriba) and isinstance(arriba[k], str) and arriba[k].strip()), None)
            # Después de "Totales" vienen la diferencia y, en Participaciones, los mismos bloques en %.
            if titulo is not None and _norm(titulo).startswith("totales"):
                break
            if titulo is None or _norm(titulo).startswith(_NO_SON_BLOQUES) or titulo in bloques:
                continue
            nns = j + 1 if j + 1 < len(fila) and _norm(fila[j + 1]) in _NNS else None
            bloques[titulo] = (j, nns)
        tabla = Tabla(list(bloques))
        i += 1
        while i < len(filas):
            datos = filas[i]
            codigo = _codigo(datos[col_sku]) if col_sku < len(datos) else None
            if codigo is None or not codigo.isdigit():
                break
            tabla.filas[codigo] = {t: tuple(_celda(datos[c])[0] if c is not None and c < len(datos) else None
                                            for c in cols) for t, cols in bloques.items()}
            i += 1
        if tabla.titulos and tabla.filas:
            encontradas.append(tabla)
    return encontradas


def es_movil(hojas: dict[str, list[list]]) -> bool:
    return set(HOJAS) <= {_norm(n) for n in hojas}


def _hoja(hojas: dict[str, list[list]], nombre: str) -> list[list]:
    return next(f for n, f in hojas.items() if _norm(n) == nombre)


def base(hojas: dict[str, list[list]]) -> tuple[dict[tuple[str, str], Decimal], list[Problema]]:
    """SKU × canal en kilos: la primera tabla de Ingredientes y la de Soluciones. Un cero no aplica."""
    reparto: dict[tuple[str, str], Decimal] = {}
    problemas: list[Problema] = []
    for nombre in ("ingredientes", "soluciones"):
        encontradas = tablas(_hoja(hojas, nombre))
        if not encontradas:
            problemas.append(Problema("error", f"No se encontró el reparto por canal en la hoja {nombre.capitalize()}.",
                                      bloque="base"))
            continue
        for sku, bloques in encontradas[0].filas.items():
            for canal, (kilos, _) in bloques.items():
                if kilos:
                    reparto[(sku, canal)] = kilos
    return reparto, problemas


def apertura(hojas: dict[str, list[list]]) -> tuple[dict[tuple[str, str], dict[str, Decimal]], list[Problema]]:
    """
    {(sku, canal): {entidad: kilos}}: los distribuidores (hoja Distribuidores) y los asesores
    del Call Center (la tabla de asesores de Soluciones, la segunda).
    """
    problemas: list[Problema] = []
    fuentes = []
    distribuidores = tablas(_hoja(hojas, "distribuidores"))
    if distribuidores:
        fuentes.append((DISTRIBUIDORES, distribuidores[0]))
    else:
        problemas.append(Problema("aviso", "No se encontró la apertura por distribuidor: Distribuidores cierra en el canal.",
                                  bloque="apertura"))
    soluciones = tablas(_hoja(hojas, "soluciones"))
    if len(soluciones) > 1:
        fuentes.append((CALL_CENTER, soluciones[1]))
    else:
        problemas.append(Problema("aviso", "No se encontró la apertura por asesor: el Call Center cierra en el canal.",
                                  bloque="apertura"))
    resultado: dict[tuple[str, str], dict[str, Decimal]] = {}
    for canal, tabla in fuentes:
        for sku, bloques in tabla.filas.items():
            celda = {entidad: kilos for entidad, (kilos, _) in bloques.items() if kilos}
            if celda:
                resultado[(sku, canal)] = celda
    return resultado, problemas
