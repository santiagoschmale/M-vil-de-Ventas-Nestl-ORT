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

REGLAS
------
Una regla (`Grupo`) limita cuánto de un canal se lleva un conjunto de SKUs: tope,
mínimo o valor fijo, en % del total del canal (input 2, fijadas incluidas). Lo
definió el negocio: cada regla es de un canal, la regla gana al histórico, y si
las reglas chocan se informa sin prioridad.

- El % se lleva a unidades mínimas sin pasarse: el tope redondea para abajo, el
  mínimo para arriba, el fijo al más cercano (y se avisa si no daba justo).
- Factibilidad: flujo con cotas inferiores. Cada regla es un nodo entre las celdas
  de sus SKUs y el canal; las reglas de un canal tienen que estar anidadas o no
  tocarse (familia laminar). Dos que se pisan en parte se informan.
- Si no se pueden cumplir, un filtro por eliminación encuentra un conjunto mínimo
  de reglas que chocan: se informan esas y no las inocentes.
- El ajuste suma un paso por regla (proyección de Bregman sobre la desigualdad):
  el resultado es el reparto más cercano al mes anterior que cumple todo.
- El redondeo controlado respeta las reglas: con familias laminares la matriz es
  totalmente unimodular y ese redondeo existe siempre.

Todo en Decimal. Nada se resuelve en silencio: lo que no puede cerrar vuelve como
inconsistencia y el planner decide.

PENDIENTE (A2): si el input 2 admite margen (se mencionó ±500 kg). Hoy cierra
exacto.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, localcontext
from fractions import Fraction
from math import ceil, floor
from typing import Mapping, Sequence

from .flujo import INFINITO, FlujoMaximo, flujo_de_costo_minimo
from .reparto import a_texto

Celda = tuple[str, str]  # (sku, canal)

PRECISION = 50  # dígitos para el ajuste; el resultado final es exacto por el redondeo controlado
TOLERANCIA = Decimal("1e-12")  # en unidades mínimas
MAX_ITERACIONES = 5000


class ErrorDeCruce(ValueError):
    """La entrada del cruce es inválida (no es un problema del negocio: es un bug de quien llama)."""


LIMITES = ("tope", "minimo", "fijo")


@dataclass(frozen=True)
class Grupo:
    """
    Una regla sobre el cruce: en `canal`, los SKUs de `skus` suman a lo sumo
    (tope), al menos (mínimo) o exactamente (fijo) `porcentaje`% del total del canal.
    `regla` es el nombre con que se la informa.
    """
    regla: str
    canal: str
    skus: frozenset[str]
    limite: str
    porcentaje: Decimal


@dataclass
class Inconsistencia:
    """Algo que impide cerrar filas y columnas. Se informa; el planner decide."""
    # totales_distintos | sku_sin_canal | canal_sin_sku | canales_sin_volumen | fijado_excede
    # | regla_incumplible | reglas_en_conflicto | reglas_superpuestas
    tipo: str
    mensaje: str
    skus: tuple[str, ...] = ()
    canales: tuple[str, ...] = ()
    diferencia: Decimal | None = None
    reglas: tuple[str, ...] = ()


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
    grupos: Sequence[Grupo] = (),
) -> ResultadoCruce:
    """
    Reparte cada SKU entre canales para que cada fila sume su total del input 1
    y cada columna su total del input 2, partiendo de la base.

    `fijas`: celdas que el planner fijó a mano. No se mueven; el resto absorbe.
    Tienen que estar en la base (fijar donde el SKU no se vende es un error).
    `grupos`: las reglas (ver REGLAS arriba).
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
    for g in grupos:
        _validar_grupo(g, c)
    totales_canal = dict(c)  # la base del % de las reglas: el total del canal, fijadas incluidas

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
            f"El objetivo de Contraloría suma {a_texto(_a_decimal(total_filas, decimales))} y los totales por canal "
            f"suman {a_texto(_a_decimal(total_columnas, decimales))}: difieren en {a_texto(dif)}. "
            f"Corregí uno de los dos para que coincidan.",
            diferencia=dif,
        ))

    # Las fijadas se descuentan de su fila y su columna.
    for (s, k), v in fijadas.items():
        r[s] -= v
        c[k] -= v
    total_filas -= sum(fijadas.values())
    inconsistencias += [
        Inconsistencia("fijado_excede", f"Lo fijado en el SKU {s} supera su objetivo en {a_texto(_a_decimal(-v, decimales))}.",
                       skus=(s,), diferencia=_a_decimal(-v, decimales))
        for s, v in sorted(r.items()) if v < 0
    ] + [
        Inconsistencia("fijado_excede", f"Lo fijado en el canal {k} supera su total en {a_texto(_a_decimal(-v, decimales))}.",
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
                    f"faltan {a_texto(_a_decimal(falta, decimales))}.")
        if que == "SKU":
            # Caso A4 (SKU sin reparto previo): la regla está pendiente con el cliente.
            return (f"El SKU {nombre} tiene objetivo pero el mes anterior no se vendió en ningún canal: "
                    f"no hay base para repartirlo. Apagalo para seguir y descontá su parte de los totales por canal.")
        return (f"El canal {nombre} tiene total pero el mes anterior no vendió ningún SKU: "
                f"no hay base para repartirlo. Revisá su total en los totales por canal.")

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

    return _repartir(grupos, r, c, totales_canal, soporte, fijadas, decimales, resultado)


_NO_CONVERGIO = "El ajuste no convergió: se usó un reparto que cierra exacto pero no sigue la base. Revisar."
_REGLAS_JUSTAS = ("Las reglas quedan muy justas para estos totales: el reparto cierra y las cumple, pero se aleja "
                  "del mes anterior más de lo necesario. Revisá las reglas que están al límite.")


# ---------------------------------------------------------------------------
# Reglas
# ---------------------------------------------------------------------------

@dataclass
class _Nodo:
    """Una o más reglas sobre el mismo conjunto de celdas libres de un canal, en unidades."""
    reglas: tuple[str, ...]
    canal: str
    skus: frozenset[str]  # los que tienen celda libre en el canal
    lo: int  # sobre lo libre: el límite menos lo fijado a mano en el grupo (puede quedar <= 0)
    hi: int | None
    fijado: int


_QUE_PIDE = {"tope": "a lo sumo", "minimo": "al menos", "fijo": "exactamente"}


def _validar_grupo(g: Grupo, columnas: Mapping[str, int]) -> None:
    if g.canal not in columnas:
        raise ErrorDeCruce(f"La regla {g.regla} es de un canal que no está en los totales por canal: {g.canal}.")
    if g.limite not in LIMITES:
        raise ErrorDeCruce(f"La regla {g.regla} tiene un límite desconocido: {g.limite!r}.")
    _exigir_decimal(g.porcentaje, f"porcentaje de la regla {g.regla}")
    if not 0 <= g.porcentaje <= 100:
        raise ErrorDeCruce(f"El porcentaje de la regla {g.regla} tiene que estar entre 0 y 100: {g.porcentaje}.")


def _limites(g: Grupo, total: int) -> tuple[int, int | None, bool]:
    """(mínimo, tope, redondeado) en unidades. El tope no se pasa y el mínimo no queda corto."""
    exacto = Fraction(g.porcentaje) * total / 100
    if g.limite == "tope":
        return 0, floor(exacto), False
    if g.limite == "minimo":
        return ceil(exacto), None, False
    valor = round(exacto)  # medio a par
    return valor, valor, valor != exacto


def _nodos(grupos: Sequence[Grupo], totales: Mapping[str, int], soporte, fijadas) -> list[_Nodo]:
    """Una entrada por conjunto de celdas: tope y mínimo sobre los mismos SKUs se combinan."""
    por_clave: dict[tuple, _Nodo] = {}
    for g in grupos:
        skus = frozenset(x for x in g.skus if (x, g.canal) in soporte)
        fijado = sum(v for (x, k), v in fijadas.items() if k == g.canal and x in g.skus)
        lo, hi, _ = _limites(g, totales[g.canal])
        lo, hi = lo - fijado, None if hi is None else hi - fijado
        n = por_clave.get((g.canal, skus))
        if n is None:
            por_clave[(g.canal, skus)] = _Nodo((g.regla,), g.canal, skus, lo, hi, fijado)
        else:
            n.reglas = tuple(sorted(n.reglas + (g.regla,)))
            n.lo = max(n.lo, lo)
            n.hi = hi if n.hi is None else n.hi if hi is None else min(n.hi, hi)
    return [por_clave[k] for k in sorted(por_clave, key=lambda k: (k[0], sorted(k[1])))]


def _superpuestas(nodos: list[_Nodo]) -> list[Inconsistencia]:
    """Reglas del mismo canal que comparten solo parte de sus SKUs: no forman un árbol."""
    inconsistencias = []
    for i, a in enumerate(nodos):
        for b in nodos[i + 1:]:
            if a.canal == b.canal and a.skus & b.skus and not (a.skus <= b.skus or b.skus <= a.skus):
                reglas = tuple(sorted(a.reglas + b.reglas))
                comunes = ", ".join(sorted(a.skus & b.skus))
                inconsistencias.append(Inconsistencia(
                    "reglas_superpuestas",
                    f"Las reglas {_lista(reglas)} en {a.canal} comparten solo parte de sus SKUs ({comunes}). "
                    f"Esa combinación todavía no se puede calcular: dejá una, o armalas para que una "
                    f"contenga a la otra.",
                    skus=tuple(sorted(a.skus & b.skus)), canales=(a.canal,), reglas=reglas,
                ))
    return inconsistencias


def _arbol(nodos: list[_Nodo]) -> tuple[dict[int, int | None], dict[Celda, int]]:
    """
    Padre de cada nodo (el menor que lo contiene; None = el canal) y, para cada
    SKU de un canal, el nodo más chico que lo contiene. Supone familia laminar.
    """
    orden = sorted(range(len(nodos)), key=lambda i: len(nodos[i].skus))
    padre, hoja = {}, {}
    for pos, i in enumerate(orden):
        padre[i] = next((j for j in orden[pos + 1:]
                         if nodos[j].canal == nodos[i].canal and nodos[i].skus < nodos[j].skus), None)
        for x in nodos[i].skus:
            hoja.setdefault((x, nodos[i].canal), i)
    return padre, hoja


def _circulacion(r, c, soporte, nodos: list[_Nodo]) -> tuple[FlujoMaximo, dict[Celda, str]] | None:
    """
    ¿Hay un reparto que cumple filas, columnas y reglas? Circulación con cotas
    inferiores: fuente -> SKU [r, r] -> regla más chica -> ... -> canal [c, c] ->
    sumidero -> fuente. Cada regla es un arco [mínimo, tope] hacia la que la
    contiene (o hacia el canal). Devuelve la red con un flujo factible y el
    destino de cada celda, o None si no hay.
    """
    if any(n.hi is not None and n.hi < max(n.lo, 0) for n in nodos):
        return None
    padre, hoja = _arbol(nodos)
    arcos = [("fuente", "s:" + x, v, v) for x, v in sorted(r.items()) if v > 0]
    destino = {}
    for x, k in sorted(soporte):
        destino[(x, k)] = f"g:{hoja[(x, k)]}" if (x, k) in hoja else "c:" + k
        arcos.append(("s:" + x, destino[(x, k)], 0, INFINITO))
    for i, n in enumerate(nodos):
        arriba = f"g:{padre[i]}" if padre[i] is not None else "c:" + n.canal
        arcos.append((f"g:{i}", arriba, max(n.lo, 0), n.hi))
    arcos += [("c:" + k, "sumidero", v, v) for k, v in sorted(c.items()) if v > 0]
    arcos.append(("sumidero", "fuente", 0, INFINITO))

    red, necesario = FlujoMaximo(), 0
    for u, v, lo, hi in arcos:
        red.agregar(u, v, INFINITO if hi is INFINITO else hi - lo)
        if lo > 0:
            red.agregar("\0S", v, lo)
            red.agregar(u, "\0T", lo)
            necesario += lo
    if necesario and red.maximo("\0S", "\0T") < necesario:
        return None
    return red, destino


def _rango(n: _Nodo, r, c, soporte) -> tuple[int, int]:
    """Lo mínimo y lo máximo que pueden sumar libres las celdas de una regla, sin la regla."""
    def puede(lo, hi):
        return _circulacion(r, c, soporte, [_Nodo(n.reglas, n.canal, n.skus, lo, hi, n.fijado)]) is not None

    def buscar(ok, desde, hasta):  # el primer valor en [desde, hasta] donde ok da verdadero
        while desde < hasta:
            medio = (desde + hasta) // 2
            desde, hasta = (desde, medio) if ok(medio) else (medio + 1, hasta)
        return desde

    total = c.get(n.canal, 0)
    minimo = buscar(lambda x: puede(0, x), 0, total)
    maximo = buscar(lambda x: not puede(x + 1, None), 0, total)
    return minimo, maximo


def _lista(nombres) -> str:
    nombres = list(nombres)
    return nombres[0] if len(nombres) == 1 else f"{', '.join(nombres[:-1])} y {nombres[-1]}"


def _conflictos(grupos, r, c, totales, soporte, fijadas, decimales) -> list[Inconsistencia]:
    """
    Filtro por eliminación: de las reglas que no se pueden cumplir juntas, saca una
    por una las que no hacen falta para que siga sin poder. Queda un conjunto
    mínimo: cada una por separado se puede, juntas no. Se repite con las que
    quedan hasta que el resto se pueda cumplir.
    """
    def puede(gs):
        return _circulacion(r, c, soporte, _nodos(gs, totales, soporte, fijadas)) is not None

    inconsistencias, restantes = [], list(grupos)
    while not puede(restantes):
        choque = list(restantes)
        for g in list(choque):
            sin = [x for x in choque if x is not g]
            if not puede(sin):
                choque = sin
        restantes = [g for g in restantes if g not in choque]
        nombres = tuple(sorted(g.regla for g in choque))
        canales = tuple(sorted({g.canal for g in choque}))
        con_fijadas = any(fijadas.get((x, g.canal)) for g in choque for x in g.skus)
        fijado_txt = " y lo fijado a mano" if con_fijadas else ""
        if len(choque) == 1:
            (g,) = choque
            (n,) = _nodos(choque, totales, soporte, fijadas)
            lo, hi, _ = _limites(g, totales[g.canal])
            pedido = hi if g.limite == "tope" else lo
            minimo, maximo = (_a_decimal(v + n.fijado, decimales) for v in _rango(n, r, c, soporte))
            posible = (f"suman {a_texto(minimo)}" if minimo == maximo
                       else f"pueden sumar entre {a_texto(minimo)} y {a_texto(maximo)}")
            inconsistencias.append(Inconsistencia(
                "regla_incumplible",
                f"La regla {g.regla} pide que sus SKUs sumen {_QUE_PIDE[g.limite]} "
                f"{a_texto(_a_decimal(pedido, decimales))} en {g.canal} ({a_texto(g.porcentaje)}% del canal), "
                f"pero con los totales del mes, dónde se vende cada SKU{fijado_txt} {posible}. "
                f"Cambiá la regla o los totales.",
                skus=tuple(sorted(g.skus)), canales=canales, reglas=nombres,
            ))
        else:
            inconsistencias.append(Inconsistencia(
                "reglas_en_conflicto",
                f"Las reglas {_lista(nombres)} no se pueden cumplir a la vez con los totales del mes"
                f"{fijado_txt}: cada una por separado sí. No hay prioridad entre reglas: cambiá o sacá alguna.",
                canales=canales, reglas=nombres,
            ))
    return inconsistencias


def _repartir(grupos, r, c, totales, soporte, fijadas, decimales, resultado) -> ResultadoCruce:
    """
    Con el problema ya factible sin reglas: aplica las reglas (si hay), saca las
    celdas que quedan en cero en cualquier solución, ajusta y redondea.
    """
    # Orden canónico: el resultado y los conflictos no dependen del orden de las reglas.
    grupos = sorted(grupos, key=lambda g: (g.regla, g.canal, sorted(g.skus), g.limite, g.porcentaje))
    avisos = []
    for g in grupos:
        lo, _, redondeado = _limites(g, totales[g.canal])
        if redondeado:
            avisos.append(f"La regla {g.regla}: {a_texto(g.porcentaje)}% de {g.canal} no cae justo en la unidad "
                          f"mínima; se usa {a_texto(_a_decimal(lo, decimales))}.")
    nodos = _nodos(grupos, totales, soporte, fijadas)
    superpuestas = _superpuestas(nodos)
    if superpuestas:
        return ResultadoCruce(celdas=None, inconsistencias=superpuestas)
    circulacion = _circulacion(r, c, soporte, nodos)
    if circulacion is None:
        return ResultadoCruce(celdas=None, inconsistencias=_conflictos(grupos, r, c, totales, soporte, fijadas,
                                                                        decimales))
    red, destino = circulacion

    comp = red.componentes()
    libres = dict(soporte)
    forzadas = sorted(k for k in soporte if red.flujo("s:" + k[0], destino[k]) == 0
                      and comp["s:" + k[0]] != comp[destino[k]])
    for k in forzadas:
        del libres[k]
    por_que = "con las reglas y los totales del mes" if grupos else "en cualquier reparto que cierre los totales"
    avisos += [f"El SKU {x} tiene base en el canal {k}, pero {por_que} esa celda queda en 0." for x, k in forzadas]

    restricciones = [
        ([k for k in libres if k[1] == n.canal and k[0] in n.skus], n.lo if n.lo > 0 else None, n.hi)
        for n in nodos
    ]
    # Con reglas la convergencia es lenta y alcanza con estar cerca (ver _ajuste_biproporcional).
    cerca = {"tolerancia": Decimal("1e-6"), "aceptable": Decimal("Infinity")} if grupos else {}
    real, iteraciones = _ajuste_biproporcional(r, c, libres, restricciones, **cerca)
    unidades = None if real is None else _redondeo_controlado(real, r, c, nodos)
    if unidades is None:
        # ponytail: con reglas muy justas (celdas casi en cero sin estar forzadas) el
        # ajuste converge muy lento; en los casos de prueba armados al límite pasa en ~3%.
        # El reparto cierra y cumple las reglas igual, pero no sigue la base. Si pasa con
        # datos reales: proyección por Newton sobre el dual, o flujo de costo convexo.
        unidades = {k: red.flujo("s:" + k[0], destino[k]) for k in soporte}
        avisos.append(_REGLAS_JUSTAS if grupos else _NO_CONVERGIO)
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
            f"{', '.join(ks)} {'necesita' if len(ks) == 1 else 'necesitan'} {a_texto(_a_decimal(necesitan, decimales))}, "
            f"pero los SKUs que se venden ahí suman {a_texto(_a_decimal(pueden, decimales))} en total: faltan {a_texto(dif)}.",
            skus=skus,
            canales=tuple(ks),
            diferencia=dif,
        ))
    return inconsistencias


def _ajuste_biproporcional(
    r: Mapping[str, int], c: Mapping[str, int], soporte: Mapping[Celda, Decimal],
    grupos: Sequence[tuple[list[Celda], int | None, int | None]] = (),
    tolerancia: Decimal = TOLERANCIA,
    aceptable: Decimal | None = None,
) -> tuple[dict[Celda, Decimal] | None, int]:
    """
    RAS / IPF en unidades mínimas: escala filas y columnas alternadamente desde la
    base. Devuelve (matriz real, iteraciones), o (None, iteraciones) si no converge.

    `grupos`: (celdas, mínimo, tope) de las reglas. Cada vuelta escala también esas
    celdas cuando la suma se sale del límite (Bregman: el factor acumulado de cada
    límite deja deshacer lo que ya no hace falta). Así converge al reparto más
    cercano a la base, en entropía relativa, que cumple todo.

    `aceptable`: si se estanca o se acaban las vueltas con un error menor, devuelve
    la matriz igual (con reglas se pasa infinito: siempre). Con reglas la
    convergencia es lenta, y el redondeo controlado que sigue cierra exacto y
    verifica cada regla: si con la matriz aproximada no puede, avisa quien llama.
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
        limites = [(ks, Decimal(lo) if lo is not None else None, Decimal(hi) if hi is not None else None)
                   for ks, lo, hi in grupos if ks]
        acumulado = [[Decimal(1), Decimal(1)] for _ in limites]  # factor ya aplicado por mínimo y por tope
        referencia = Decimal("Infinity")
        for iteracion in range(1, MAX_ITERACIONES + 1):
            for s, ks in por_fila.items():
                factor = Decimal(r[s]) / sum(m[k] for k in ks)
                for k in ks:
                    m[k] *= factor
            for (ks, lo, hi), acum in zip(limites, acumulado):
                for lado, limite in ((0, lo), (1, hi)):
                    suma = sum(m[k] for k in ks)
                    if limite is None or suma == 0:
                        continue
                    elegir = max if lado == 0 else min
                    factor = elegir(limite / suma, 1 / acum[lado])
                    acum[lado] *= factor
                    for k in ks:
                        m[k] *= factor
            for canal, ks in por_columna.items():
                factor = Decimal(c[canal]) / sum(m[k] for k in ks)
                for k in ks:
                    m[k] *= factor
            error = max((abs(sum(m[k] for k in ks) - r[s]) for s, ks in por_fila.items()), default=Decimal(0))
            for ks, lo, hi in limites:
                suma = sum(m[k] for k in ks)
                error = max(error, lo - suma if lo is not None else 0, suma - hi if hi is not None else 0)
            if error < tolerancia:
                return m, iteracion
            # Sin celdas de borde la convergencia es lineal: si en 100 vueltas el error no
            # baja a la mitad (con reglas: un 10%), está estancado y no tiene sentido
            # seguir quemando CPU.
            if iteracion % 100 == 0:
                if error > referencia * (Decimal("0.9") if limites else Decimal("0.5")):
                    break
                referencia = error
        if aceptable is not None and error < aceptable:
            return m, iteracion
    return None, iteracion


def _redondeo_controlado(
    real: Mapping[Celda, Decimal], r: Mapping[str, int], c: Mapping[str, int],
    nodos: Sequence[_Nodo] = (),
) -> dict[Celda, int] | None:
    """
    Cada celda al piso o al techo de su valor real, de forma que filas y columnas
    cierren exacto. Qué celdas suben lo decide un flujo de costo mínimo con costo
    = -resto: suben las de mayor resto (largest remainder en dos dimensiones).
    Existe siempre que la matriz real tenga filas y columnas enteras (Bacharach).

    Con reglas, cada regla es un nodo entre sus celdas y el canal: cuántas celdas
    suben ahí queda entre lo que pide su mínimo y lo que deja su tope. El mínimo se
    fuerza con un costo muy negativo en esa parte del arco: si se puede cumplir, el
    flujo de costo mínimo la usa entera.
    """
    pisos = {k: floor(v) for k, v in real.items()}
    faltan_fila = {s: v for s, v in r.items() if v > 0}
    faltan_columna = {x: v for x, v in c.items() if v > 0}
    for (s, x), v in pisos.items():
        faltan_fila[s] -= v
        faltan_columna[x] -= v
    if any(v < 0 for v in [*faltan_fila.values(), *faltan_columna.values()]):
        return None
    if not nodos:
        arcos = {k: -(v - pisos[k]) for k, v in real.items() if v - pisos[k] > 0}
        suben = flujo_de_costo_minimo(faltan_fila, faltan_columna, arcos)
        if suben is None:
            return None
        return {k: pisos[k] + suben.get(k, 0) for k in real}

    padre, hoja = _arbol(list(nodos))
    nombre = {i: f"\x01{i}" for i in range(len(nodos))}  # no choca con un canal
    destino = {k: nombre[hoja[k]] if k in hoja else k[1] for k in real}
    arcos = {(k[0], destino[k]): -(v - pisos[k]) for k, v in real.items() if v - pisos[k] > 0}
    grande = Decimal(len(arcos) + 1)  # más que cualquier suma de restos
    intermedios, piso_minimo = [], {}
    for i, n in enumerate(nodos):
        celdas = [k for k in real if k[1] == n.canal and k[0] in n.skus]
        base = sum(pisos[k] for k in celdas)
        minimo = max(n.lo, 0) - base
        tope = len(celdas) if n.hi is None else n.hi - base
        if tope < 0 or minimo > tope:
            return None
        minimo = max(minimo, 0)
        arriba = nombre[padre[i]] if padre[i] is not None else n.canal
        if minimo:
            intermedios.append((nombre[i], arriba, minimo, -grande))
        intermedios.append((nombre[i], arriba, tope - minimo, Decimal(0)))
        piso_minimo[i] = (celdas, minimo)
    suben = flujo_de_costo_minimo(faltan_fila, faltan_columna, arcos, intermedios)
    if suben is None:
        return None
    unidades = {k: pisos[k] + suben.get((k[0], destino[k]), 0) for k in real}
    for celdas, minimo in piso_minimo.values():
        if sum(unidades[k] - pisos[k] for k in celdas) < minimo:
            return None
    return unidades
