"""
Recorrido de punta a punta, sin interfaz: input 1 + input 2 + base -> cruce en
kilos y en plata -> inconsistencias -> Excel.

    cd backend && .venv/bin/python -m src.movil.recorrido \\
        --input1 ../data/sample/input1_objetivo.xlsx \\
        --input2 ../data/sample/input2_canales.tsv \\
        --base ../data/sample/base_mes_anterior.xlsx \\
        --apagar 90020900 --salida movil.xlsx

Kilos y plata se cruzan por separado, cada uno contra su propio total ("cada unidad
se reparte y cuadra por separado"). Los dos usan la misma base del mes anterior: el
ajuste escala filas y columnas, así que el precio de cada canal lo absorbe solo.

Esta capa arma las entradas y presenta el resultado; las cuentas son del dominio.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Font

from src.domain.arbol import Problema
from src.domain.cruce import Celda, ResultadoCruce, cruzar
from src.importer.entradas import (
    KILOS,
    PLATA,
    ObjetivoSku,
    TotalCanal,
    leer_base,
    leer_input1,
    leer_input2,
)


@dataclass
class Recorrido:
    objetivos: dict[str, ObjetivoSku]
    canales: dict[str, TotalCanal]
    kilos: ResultadoCruce
    plata: ResultadoCruce | None  # None si algún input no trae plata
    problemas: list[Problema] = field(default_factory=list)
    apagados: frozenset[str] = frozenset()


def armar(
    objetivos: dict[str, ObjetivoSku],
    canales: dict[str, TotalCanal],
    base: dict[Celda, Decimal],
    apagados: set[str] | frozenset[str] = frozenset(),
    fijas_kilos: dict[Celda, Decimal] | None = None,
    fijas_plata: dict[Celda, Decimal] | None = None,
    problemas: list[Problema] | None = None,
) -> Recorrido:
    """
    `apagados`: SKUs que el planner saca del mes (ON/OFF). No se reparten; si su
    objetivo estaba contado en el input 2, el cruce va a informar que los totales no
    coinciden, y es el planner quien ajusta el input 2.
    """
    problemas = list(problemas or [])
    apagados = frozenset(apagados)
    activos = {s: o for s, o in objetivos.items() if s not in apagados and o.kilos > 0}

    for s in sorted({s for s, _ in base} - set(objetivos)):
        problemas.append(Problema("aviso", f"El SKU {s} está en la base del mes anterior pero no en el input 1: "
                                           f"no se reparte.", sku=s, bloque="base"))
    for c in sorted({c for _, c in base} - set(canales)):
        problemas.append(Problema("aviso", f"El canal {c} está en la base del mes anterior pero no en el input 2: "
                                           f"no se reparte.", bloque="base"))

    kilos = cruzar(
        filas={s: o.kilos for s, o in activos.items()},
        columnas={c: t.kilos for c, t in canales.items()},
        base=base,
        decimales=KILOS,
        fijas=fijas_kilos,
    )
    hay_plata = all(o.nns is not None for o in activos.values()) and all(t.plata is not None for t in canales.values())
    plata = None
    if hay_plata:
        plata = cruzar(
            filas={s: o.nns for s, o in activos.items() if o.nns > 0},
            columnas={c: t.plata for c, t in canales.items()},
            base=base,
            decimales=PLATA,
            fijas=fijas_plata,
        )
    return Recorrido(objetivos=objetivos, canales=canales, kilos=kilos, plata=plata, problemas=problemas,
                     apagados=apagados)


def desde_archivos(input1, input2_texto: str, base_origen, **opciones) -> Recorrido:
    objetivos, p1 = leer_input1(input1)
    canales, p2 = leer_input2(input2_texto)
    base, p3 = leer_base(base_origen)
    return armar(objetivos, canales, base, problemas=p1 + p2 + p3, **opciones)


# ---------------------------------------------------------------------------
# Salida en Excel
# ---------------------------------------------------------------------------

def exportar(recorrido: Recorrido, destino) -> None:
    """
    Una hoja por unidad (SKU × canal, con los totales para verificar) y una hoja
    con los problemas de los archivos y las inconsistencias. Si el cruce no cerró,
    la hoja de esa unidad queda vacía y el motivo está en Problemas.
    """
    libro = Workbook()
    libro.remove(libro.active)
    canales = sorted(recorrido.canales)
    for nombre, cruce, total_sku, total_canal, formato in (
        ("Kilos", recorrido.kilos, lambda o: o.kilos, lambda t: t.kilos, "#,##0.000"),
        ("Plata", recorrido.plata, lambda o: o.nns, lambda t: t.plata, "#,##0.00"),
    ):
        hoja = libro.create_sheet(nombre)
        hoja.append(["Código SKU", "Descripción", "Objetivo"] + canales)
        for c in hoja[1]:
            c.font = Font(bold=True)
        if cruce is None or cruce.celdas is None:
            hoja.append(["Sin reparto: ver la hoja Problemas."])
            continue
        skus = sorted({s for s, _ in cruce.celdas})
        for s in skus:
            o = recorrido.objetivos[s]
            fila = [s, o.descripcion, total_sku(o)] + [cruce.celdas.get((s, c)) for c in canales]
            hoja.append(fila)
        hoja.append(["Total del reparto", None, sum((total_sku(recorrido.objetivos[s]) for s in skus), Decimal(0))]
                    + [sum((v for (_, x), v in cruce.celdas.items() if x == c), Decimal(0)) for c in canales])
        hoja.append(["Total pedido (input 2)", None, None] + [total_canal(recorrido.canales[c]) for c in canales])
        for fila in hoja.iter_rows(min_row=2, min_col=3):
            for celda in fila:
                celda.number_format = formato

    hoja = libro.create_sheet("Problemas")
    hoja.append(["Origen", "Severidad", "SKU", "Canal", "Detalle"])
    for c in hoja[1]:
        c.font = Font(bold=True)
    for unidad, cruce in (("kilos", recorrido.kilos), ("plata", recorrido.plata)):
        if cruce is None:
            continue
        for i in cruce.inconsistencias:
            hoja.append([f"cruce {unidad}", "error", ", ".join(i.skus), ", ".join(i.canales), i.mensaje])
        for a in cruce.avisos:
            hoja.append([f"cruce {unidad}", "aviso", None, None, a])
    for p in recorrido.problemas:
        hoja.append([p.bloque or "archivo", p.severidad, p.sku, None, p.mensaje])
    libro.save(destino)


# ---------------------------------------------------------------------------
# Línea de comandos
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Recorrido del móvil: inputs -> cruce -> Excel.")
    parser.add_argument("--input1", required=True, type=Path, help="Excel de Contraloría")
    parser.add_argument("--input2", required=True, type=Path, help="Tabla de totales por canal (texto)")
    parser.add_argument("--base", required=True, type=Path, help="Excel con el reparto del mes anterior")
    parser.add_argument("--apagar", action="append", default=[], help="Código de SKU a sacar del mes (repetible)")
    parser.add_argument("--salida", required=True, type=Path, help="Excel de salida")
    args = parser.parse_args(argv)

    r = desde_archivos(args.input1, args.input2.read_text(encoding="utf-8"), args.base, apagados=set(args.apagar))
    exportar(r, args.salida)
    for unidad, cruce in (("Kilos", r.kilos), ("Plata", r.plata)):
        if cruce is None:
            print(f"{unidad}: no se cruzó (falta la columna en algún input).")
        elif cruce.celdas is None:
            print(f"{unidad}: NO CIERRA.")
            for i in cruce.inconsistencias:
                print(f"  - {i.mensaje}")
        else:
            print(f"{unidad}: cierra exacto ({len(cruce.celdas)} celdas, {cruce.iteraciones} iteraciones).")
            for a in cruce.avisos:
                print(f"  aviso: {a}")
    errores = sum(1 for p in r.problemas if p.severidad == "error")
    print(f"Archivos: {errores} errores, {len(r.problemas) - errores} avisos. Detalle en {args.salida}.")
    cerro = r.kilos.celdas is not None and (r.plata is None or r.plata.celdas is not None)
    return 0 if cerro else 1


if __name__ == "__main__":
    sys.exit(main())
