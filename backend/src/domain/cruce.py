"""
El cruce SKU × canal: el centro del cálculo del móvil.

Filas = input 1: el total de cada SKU (Contraloría). Cierra exacto.
Columnas = input 2: el total de cada canal (el planner).
Base = el reparto del mes anterior: dónde se vende cada SKU y con qué
proporción arrancar. Una celda sin base es "no aplica" (cero forzado); una celda
con base 0 es "aplica con cero" (existe y vale 0).

CÓMO SE CALCULA
---------------
1. Validación y chequeos directos: los dos inputs suman lo mismo, cada SKU se
   vende en algún canal, cada canal tiene algún SKU.
2. Factibilidad por flujo máximo: ¿existe algún reparto que cumpla filas y
   columnas con las celdas permitidas? Si no, el corte mínimo dice qué canales
   necesitan más de lo que los SKUs que se venden ahí pueden darles.
3. El mismo flujo dice qué celdas tienen que quedar en cero en cualquier
   solución (se sacan y se avisa). Sin eso el ajuste converge muy lento.
4. Ajuste biproporcional (RAS / IPF) desde la base: se escalan filas y columnas
   alternadamente hasta que las dos cierran. Conserva la estructura del mes
   anterior: solo corrige lo necesario.
5. Redondeo controlado a la unidad mínima: cada celda va al piso o al techo de su
   valor, eligiendo por flujo de costo mínimo para que filas y columnas cierren
   exacto, prefiriendo las celdas de mayor resto.

Todo en Decimal. Nada se resuelve en silencio: lo que no puede cerrar vuelve como
inconsistencia y el planner decide.

PENDIENTE (A2): si el input 2 admite margen (se mencionó ±500 kg). Hoy cierra
exacto.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, localcontext
from fractions import Fraction
from math import floor
from typing import Mapping

from .flujo import INFINITO, FlujoMaximo, flujo_de_costo_minimo

Celda = tuple[str, str]  # (sku, canal)

PRECISION = 50  # dígitos para el ajuste; el resultado final es exacto por el redondeo controlado
TOLERANCIA = Decimal("1e-12")  # en unidades mínimas
MAX_ITERACIONES = 5000


class ErrorDeCruce(ValueError):
    """La entrada del cruce es inválida (no es un problema del negocio: es un bug de quien llama)."""


@dataclass
class Inconsistencia:
    """Algo que impide cerrar filas y columnas. Se informa; el planner decide."""
    tipo: str  # totales_distintos | sku_sin_canal | canal_sin_sku | canales_sin_volumen | fijado_excede
    mensaje: str
    skus: tuple[str, ...] = ()
    canales: tuple[str, ...] = ()
    diferencia: Decimal | None = None


@dataclass
class ResultadoCruce:
    celdas: dict[Celda, Decimal] | None  # None si hay inconsistencias
    inconsistencias: list[Inconsistencia] = field(default_factory=list)
    avisos: list[str] = field(default_factory=list)
    iteraciones: int = 0


def cruzar(
    filas: Mapping[str, Decimal],
    columnas: Mapping[str, Decimal],
    base: Mapping[Celda, Decimal],
    decimales: int = 3,
    fijas: Mapping[Celda, Decimal] | None = None,
) -> ResultadoCruce:
    """
    Reparte cada SKU entre canales para que cada fila sume su total del input 1
    y cada columna su total del input 2, partiendo de la base.

    `fijas`: celdas que el planner fijó a mano. No se mueven; el resto absorbe.
    Tienen que estar en la base (fijar donde el SKU no se vende es un error).
    """
    if type(decimales) is not int or decimales < 0:
        raise ErrorDeCruce(f"decimales tiene que ser un entero >= 0, llegó {decimales!r}.")
    fijas = dict(fijas or {})
    # Orden canónico: todo lo que sigue recorre filas, columnas y base ordenadas, así
    # el resultado no depende del orden de carga (tampoco en los desempates).
    r = {s: _unidades(v, decimales, f"objetivo del SKU {s}") for s, v in sorted(filas.items())}
    c = {k: _unidades(v, decimales, f"total del canal {k}") for k, v in sorted(columnas.items())}
    semillas = {}
    for celda, peso in sorted(base.items()):
        _exigir_decimal(peso, f"base de {celda}")
        if peso < 0:
            raise ErrorDeCruce(f"La base de {celda} es negativa: {peso}.")
        semillas[celda] = peso
    fijadas = {}
    for celda, v in sorted(fijas.items()):
        if celda not in semillas:
            raise ErrorDeCruce(f"No se puede fijar {celda}: el SKU no se vende en ese canal.")
        if celda[0] not in r or celda[1] not in c:
            raise ErrorDeCruce(f"No se puede fijar {celda}: el SKU o el canal no están en los inputs del mes.")
        fijadas[celda] = _unidades(v, decimales, f"valor fijado de {celda}")

    def resultado(unidades: dict[Celda, int], **extra) -> ResultadoCruce:
        celdas = {k: _a_decimal(unidades.get(k, 0), decimales) for k in semillas if k[0] in r and k[1] in c}
        return ResultadoCruce(celdas=celdas, **extra)

    # Chequeos directos: se juntan todos antes de cortar, para que el planner vea
    # todos los problemas de una vez y no uno por vuelta.
    inconsistencias = []
    total_filas, total_columnas = sum(r.values()), sum(c.values())
    if total_filas != total_columnas:
        dif = _a_decimal(abs(total_filas - total_columnas), decimales)
        inconsistencias.append(Inconsistencia(
            "totales_distintos",
            f"El objetivo por SKU (input 1) suma {_a_decimal(total_filas, decimales)} y los totales por canal "
            f"(input 2) suman {_a_decimal(total_columnas, decimales)}: difieren en {dif}.",
            diferencia=dif,
        ))

    # Las fijadas se descuentan de su fila y su columna.
    for (s, k), v in fijadas.items():
        r[s] -= v
        c[k] -= v
    total_filas -= sum(fijadas.values())
    inconsistencias += [
        Inconsistencia("fijado_excede", f"Lo fijado en el SKU {s} supera su objetivo en {_a_decimal(-v, decimales)}.",
                       skus=(s,), diferencia=_a_decimal(-v, decimales))
        for s, v in sorted(r.items()) if v < 0
    ] + [
        Inconsistencia("fijado_excede", f"Lo fijado en el canal {k} supera su total en {_a_decimal(-v, decimales)}.",
                       canales=(k,), diferencia=_a_decimal(-v, decimales))
        for k, v in sorted(c.items()) if v < 0
    ]

    # Celdas que pueden recibir algo: base positiva, sin fijar, con fila y columna por repartir.
    soporte = {
        k: w for k, w in semillas.items()
        if w > 0 and k not in fijadas and r.get(k[0], 0) > 0 and c.get(k[1], 0) > 0
    }
    filas_con_canal = {s for s, _ in soporte}
    columnas_con_sku = {k for _, k in soporte}
    sin_canal = [s for s, v in r.items() if v > 0 and s not in filas_con_canal]
    sin_sku = [k for k, v in c.items() if v > 0 and k not in columnas_con_sku]
    filas_fijadas = {k[0] for k in fijadas}
    columnas_fijadas = {k[1] for k in fijadas}

    def sin_celdas_libres(que: str, nombre: str, falta: int, fijado: bool) -> str:
        if fijado:
            return (f"Lo fijado en el {que} {nombre} no alcanza su total y no le quedan celdas libres: "
                    f"faltan {_a_decimal(falta, decimales)}.")
        if que == "SKU":
            return (f"El SKU {nombre} tiene objetivo pero no tiene reparto previo en ningún canal "
                    f"(caso A4: SKU sin reparto previo, regla pendiente).")
        return f"El canal {nombre} tiene total pero ningún SKU se vendió ahí el mes anterior."

    inconsistencias += [
        Inconsistencia("sku_sin_canal", sin_celdas_libres("SKU", s, r[s], s in filas_fijadas), skus=(s,),
                       diferencia=_a_decimal(r[s], decimales))
        for s in sin_canal
    ] + [
        Inconsistencia("canal_sin_sku", sin_celdas_libres("canal", k, c[k], k in columnas_fijadas), canales=(k,),
                       diferencia=_a_decimal(c[k], decimales))
        for k in sin_sku
    ]
    if inconsistencias:
        return ResultadoCruce(celdas=None, inconsistencias=inconsistencias)

    # Factibilidad: ¿algún reparto cumple todo con las celdas permitidas?
    red = _red(r, c, soporte)
    if red.maximo("fuente", "sumidero") < total_filas:
        return ResultadoCruce(celdas=None, inconsistencias=_deficits(red, r, c, soporte, decimales))

    # Celdas que en cualquier solución quedan en cero: se sacan del ajuste y se avisan.
    comp = red.componentes()
    forzadas = sorted(k for k in soporte if red.flujo("s:" + k[0], "c:" + k[1]) == 0
                      and comp["s:" + k[0]] != comp["c:" + k[1]])
    avisos = [
        f"El SKU {s} tiene base en el canal {k}, pero en cualquier reparto que cierre los totales "
        f"esa celda queda en 0."
        for s, k in forzadas
    ]
    for k in forzadas:
        del soporte[k]

    real, iteraciones = _ajuste_biproporcional(r, c, soporte)
    unidades = None if real is None else _redondeo_controlado(real, r, c)
    if unidades is None:
        # No debería pasar: el problema es factible y sin celdas de borde. Si pasa, se
        # usa la solución entera del flujo (cierra exacto, pero lejos de la base) y se avisa.
        unidades = {k: red.flujo("s:" + k[0], "c:" + k[1]) for k in soporte}
        avisos.append("El ajuste no convergió: se usó un reparto que cierra exacto pero no sigue la base. Revisar.")
    unidades.update(fijadas)
    return resultado(unidades, avisos=avisos, iteraciones=iteraciones)


# ---------------------------------------------------------------------------

def _exigir_decimal(valor, que: str) -> None:
    if not isinstance(valor, Decimal) or not valor.is_finite():
        raise ErrorDeCruce(f"El {que} tiene que ser un Decimal finito, llegó {valor!r}.")


def _unidades(valor, decimales: int, que: str) -> int:
    _exigir_decimal(valor, que)
    if valor < 0:
        raise ErrorDeCruce(f"El {que} es negativo: {valor}.")
    u = Fraction(valor) * 10**decimales
    if u.denominator != 1:
        raise ErrorDeCruce(f"El {que} ({valor}) tiene más de {decimales} decimales.")
    return int(u)


def _a_decimal(unidades: int, decimales: int) -> Decimal:
    return Decimal(f"{unidades}E-{decimales}")


def _red(r: dict[str, int], c: dict[str, int], soporte: Mapping[Celda, Decimal]) -> FlujoMaximo:
    """fuente -> SKU (su total) -> canal (sin tope, si se vende ahí) -> sumidero (total del canal)."""
    red = FlujoMaximo()
    for s in sorted(r):
        red.agregar("fuente", "s:" + s, r[s])
    for s, k in sorted(soporte):
        red.agregar("s:" + s, "c:" + k, INFINITO)
    for k in sorted(c):
        red.agregar("c:" + k, "sumidero", c[k])
    return red


def _deficits(red: FlujoMaximo, r, c, soporte, decimales: int) -> list[Inconsistencia]:
    """
    Del corte mínimo: los canales del lado del sumidero necesitan más de lo que
    suman los SKUs que se venden ahí (condición de Hall). Se separan en grupos que
    no comparten SKUs, para que cada faltante se informe con su propia diferencia.
    """
    lado_fuente = red.alcanzables("fuente")
    canales = {k for k in c if "c:" + k not in lado_fuente and c[k] > 0}
    # Grupos: componentes conexas de canales unidos por SKUs que se venden en ambos.
    grupo = {k: k for k in canales}

    def raiz(k):
        while grupo[k] != k:
            grupo[k] = grupo[grupo[k]]
            k = grupo[k]
        return k

    canales_de_sku: dict[str, list[str]] = {}
    for s, k in soporte:
        if k in canales:
            canales_de_sku.setdefault(s, []).append(k)
    for ks in canales_de_sku.values():
        for k in ks[1:]:
            grupo[raiz(k)] = raiz(ks[0])
    grupos: dict[str, list[str]] = {}
    for k in sorted(canales):
        grupos.setdefault(raiz(k), []).append(k)

    inconsistencias = []
    for ks in grupos.values():
        skus = tuple(sorted(s for s, kk in canales_de_sku.items() if set(kk) & set(ks)))
        necesitan = sum(c[k] for k in ks)
        pueden = sum(r[s] for s in skus)
        if necesitan <= pueden:
            continue  # este grupo solo no es el problema
        dif = _a_decimal(necesitan - pueden, decimales)
        inconsistencias.append(Inconsistencia(
            "canales_sin_volumen",
            f"{', '.join(ks)} {'necesita' if len(ks) == 1 else 'necesitan'} {_a_decimal(necesitan, decimales)}, "
            f"pero los SKUs que se venden ahí suman {_a_decimal(pueden, decimales)} en total: faltan {dif}.",
            skus=skus,
            canales=tuple(ks),
            diferencia=dif,
        ))
    return inconsistencias


def _ajuste_biproporcional(
    r: Mapping[str, int], c: Mapping[str, int], soporte: Mapping[Celda, Decimal]
) -> tuple[dict[Celda, Decimal] | None, int]:
    """
    RAS / IPF en unidades mínimas: escala filas y columnas alternadamente desde la
    base. Devuelve (matriz real, iteraciones), o (None, iteraciones) si no converge.
    """
    celdas = sorted(k for k in soporte if soporte[k] > 0 and r.get(k[0], 0) > 0 and c.get(k[1], 0) > 0)
    por_fila: dict[str, list[Celda]] = {}
    por_columna: dict[str, list[Celda]] = {}
    for k in celdas:
        por_fila.setdefault(k[0], []).append(k)
        por_columna.setdefault(k[1], []).append(k)

    with localcontext() as ctx:
        ctx.prec = PRECISION
        m = {k: Decimal(soporte[k]) for k in celdas}
        referencia = Decimal("Infinity")
        for iteracion in range(1, MAX_ITERACIONES + 1):
            for s, ks in por_fila.items():
                factor = Decimal(r[s]) / sum(m[k] for k in ks)
                for k in ks:
                    m[k] *= factor
            for canal, ks in por_columna.items():
                factor = Decimal(c[canal]) / sum(m[k] for k in ks)
                for k in ks:
                    m[k] *= factor
            error = max((abs(sum(m[k] for k in ks) - r[s]) for s, ks in por_fila.items()), default=Decimal(0))
            if error < TOLERANCIA:
                return m, iteracion
            # Sin celdas de borde la convergencia es lineal: si en 100 vueltas el error no
            # baja a la mitad, está estancado y no tiene sentido seguir quemando CPU.
            if iteracion % 100 == 0:
                if error > referencia / 2:
                    return None, iteracion
                referencia = error
    return None, MAX_ITERACIONES


def _redondeo_controlado(
    real: Mapping[Celda, Decimal], r: Mapping[str, int], c: Mapping[str, int]
) -> dict[Celda, int] | None:
    """
    Cada celda al piso o al techo de su valor real, de forma que filas y columnas
    cierren exacto. Qué celdas suben lo decide un flujo de costo mínimo con costo
    = -resto: suben las de mayor resto (largest remainder en dos dimensiones).
    Existe siempre que la matriz real tenga filas y columnas enteras (Bacharach).
    """
    pisos = {k: floor(v) for k, v in real.items()}
    faltan_fila = {s: v for s, v in r.items() if v > 0}
    faltan_columna = {x: v for x, v in c.items() if v > 0}
    for (s, x), v in pisos.items():
        faltan_fila[s] -= v
        faltan_columna[x] -= v
    if any(v < 0 for v in [*faltan_fila.values(), *faltan_columna.values()]):
        return None
    arcos = {k: -(v - pisos[k]) for k, v in real.items() if v - pisos[k] > 0}
    suben = flujo_de_costo_minimo(faltan_fila, faltan_columna, arcos)
    if suben is None:
        return None
    return {k: pisos[k] + suben.get(k, 0) for k in real}
