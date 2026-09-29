"""
La sesión del mes: lo que cargó el planner, lo que ajustó y el resultado.

Guarda las tres entradas (input 1, input 2, base con su apertura), los SKUs y las
entidades apagadas, las celdas fijadas, y el historial de cada cambio con quién,
cuándo y por qué. Con cada cambio recalcula el recorrido entero: es barato y evita
razonar qué quedó desactualizado.

Todo ajuste del planner (fijar, desfijar, apagar, prender) exige un motivo. Las
cargas de entradas quedan en el historial sin motivo: son los lineamientos del mes.

Una edición imposible se rechaza y no deja nada a medias: monto negativo, mayor que
el objetivo del SKU o que el total del canal, más decimales que la unidad, o una
celda donde el SKU no se vende. Lo que no cierra por una secuencia de ajustes se
permite y queda marcado: el planner trabaja en pasos y necesita estados intermedios.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

from src.domain.cruce import Celda, ErrorDeCruce
from src.domain.formato import a_texto
from src.importer.entradas import (
    KILOS,
    PLATA,
    ErrorDeEntrada,
    leer_apertura,
    leer_base,
    leer_input1,
    leer_input2,
    normalizar,
    numero,
)
from src.domain.problema import Problema
from src.domain.cruce import LIMITES
from src.movil.recorrido import Recorrido, Regla, armar

UNIDADES = {"kilos": KILOS, "plata": PLATA}


class ErrorDeAjuste(ValueError):
    """El ajuste pedido es imposible o está incompleto; no se aplicó nada."""


@dataclass
class Ajuste:
    """Una entrada del historial: qué se hizo, sobre qué, quién, cuándo y por qué."""
    accion: str
    detalle: str
    autor: str
    cuando: datetime
    motivo: str | None = None


@dataclass
class Fijada:
    valor: Decimal
    ajuste: Ajuste


@dataclass
class ReglaCargada:
    regla: Regla
    ajuste: Ajuste  # el último cambio: quién, cuándo y por qué


@dataclass
class _Entradas:
    objetivos: dict | None = None
    problemas1: list[Problema] = field(default_factory=list)
    archivo1: str | None = None
    canales: dict | None = None
    problemas2: list[Problema] = field(default_factory=list)
    archivo2: str | None = None  # None si se cargó o editó como tabla en la pantalla
    base: dict | None = None
    apertura: dict = field(default_factory=dict)
    problemas_base: list[Problema] = field(default_factory=list)
    archivo_base: str | None = None


class Sesion:
    def __init__(self):
        self._e = _Entradas()
        self.apagados_skus: dict[str, Ajuste] = {}
        self.entidades_apagadas: dict[str, Ajuste] = {}
        self._fijas: dict[str, dict[Celda, Fijada]] = {"kilos": {}, "plata": {}}
        self.reglas: dict[str, ReglaCargada] = {}
        # SKU repetido en el objetivo de Contraloría -> (fila del Excel que vale, quién lo decidió).
        self.filas_elegidas: dict[str, tuple[int, Ajuste]] = {}
        # "Dónde se vende": SKU -> (canales, quién lo decidió). Resuelve el SKU sin historia (A4).
        self.canales_sku: dict[str, tuple[frozenset[str], Ajuste]] = {}
        self._proxima_regla = 1  # los ids no se reusan: el historial los nombra
        self.historial: list[Ajuste] = []
        self.recorrido: Recorrido | None = None

    # --- entradas -----------------------------------------------------------

    def faltan(self) -> list[str]:
        return [n for n, v in (("objetivo de Contraloría", self._e.objetivos), ("totales por canal", self._e.canales),
                               ("mes anterior", self._e.base)) if v is None]

    @property
    def entradas(self) -> _Entradas:
        return self._e

    def cargar_input1(self, origen, nombre: str, autor: str, cuando: datetime) -> None:
        objetivos, problemas = _leer(leer_input1, origen)

        def cambio():
            self._e.objetivos, self._e.problemas1, self._e.archivo1 = objetivos, problemas, nombre
            self.filas_elegidas = {}  # otro archivo: las elecciones del anterior no aplican
            return Ajuste("cargar_input1", nombre, autor, cuando)
        self._aplicar(cambio)

    def cargar_input2(self, origen, autor: str, cuando: datetime, nombre: str | None = None) -> None:
        """`origen`: el Excel de totales por canal, o la tabla en texto (editada en la pantalla)."""
        canales, problemas = _leer(leer_input2, origen)

        def cambio():
            self._e.canales, self._e.problemas2, self._e.archivo2 = canales, problemas, nombre
            detalle = f"{nombre} · {len(canales)} canales" if nombre else f"{len(canales)} canales, editados a mano"
            return Ajuste("cargar_input2", detalle, autor, cuando)
        self._aplicar(cambio)

    def cargar_base(self, origen, nombre: str, autor: str, cuando: datetime) -> None:
        base, problemas = _leer(leer_base, origen)
        if hasattr(origen, "seek"):
            origen.seek(0)
        try:
            apertura, problemas_apertura = leer_apertura(origen)
        except ErrorDeEntrada:
            apertura, problemas_apertura = {}, [Problema(
                "aviso", "La base no tiene apertura debajo del canal: los canales cierran en el canal.",
                bloque="apertura")]

        def cambio():
            self._e.base, self._e.apertura = base, apertura
            self._e.problemas_base, self._e.archivo_base = problemas + problemas_apertura, nombre
            return Ajuste("cargar_base", nombre, autor, cuando)
        self._aplicar(cambio)

    # --- ajustes del planner -----------------------------------------------

    def cambiar_sku(self, sku: str, activo: bool, autor: str, cuando: datetime, motivo: str) -> None:
        motivo = _motivo(motivo)
        if self._e.objetivos is None or sku not in self._e.objetivos:
            raise ErrorDeAjuste(f"El SKU {sku} no está en el objetivo de Contraloría.")
        def cambio():
            ajuste = Ajuste("prender_sku" if activo else "apagar_sku", sku, autor, cuando, motivo)
            if activo:
                self.apagados_skus.pop(sku, None)
            else:
                self.apagados_skus[sku] = ajuste
            return ajuste
        self._aplicar(cambio)

    def cambiar_entidad(self, entidad: str, activo: bool, autor: str, cuando: datetime, motivo: str) -> None:
        motivo = _motivo(motivo)
        existentes = {e for pesos in self._e.apertura.values() for e in pesos}
        if entidad not in existentes:
            raise ErrorDeAjuste(f"No hay ninguna entidad {entidad} en la apertura del mes anterior.")
        def cambio():
            ajuste = Ajuste("prender_entidad" if activo else "apagar_entidad", entidad, autor, cuando, motivo)
            if activo:
                self.entidades_apagadas.pop(entidad, None)
            else:
                self.entidades_apagadas[entidad] = ajuste
            return ajuste
        self._aplicar(cambio)

    def fijas(self, unidad: str) -> dict[Celda, Fijada]:
        return dict(self._fijas[unidad])

    def fijar(self, unidad: str, sku: str, canal: str, monto: str, autor: str, cuando: datetime,
              motivo: str) -> None:
        motivo = _motivo(motivo)
        decimales = self._unidad(unidad)
        r = self._exigir_recorrido()
        valor = numero(monto) if isinstance(monto, str) else None
        if valor is None:
            raise ErrorDeAjuste(f"'{monto}' no es un número.")
        if valor < 0:
            raise ErrorDeAjuste("El valor no puede ser negativo.")
        paso = Decimal(1).scaleb(-decimales)
        if valor % paso != 0:
            raise ErrorDeAjuste(f"{unidad} admite como máximo {decimales} decimales.")
        if sku not in r.objetivos or sku in self.apagados_skus:
            raise ErrorDeAjuste(f"El SKU {sku} no está en el reparto de este mes.")
        if canal not in r.canales:
            raise ErrorDeAjuste(f"El canal {canal} no está en los totales por canal.")
        if not self._se_vende(sku, canal):
            raise ErrorDeAjuste(f"El SKU {sku} no se vende en {canal}: no se puede fijar.")
        objetivo = r.objetivos[sku].kilos if unidad == "kilos" else r.objetivos[sku].nns
        total_canal = r.canales[canal].kilos if unidad == "kilos" else r.canales[canal].plata
        if objetivo is not None and valor > objetivo:
            raise ErrorDeAjuste(f"El valor supera el objetivo del SKU {sku} ({_con_unidad(objetivo, unidad)}).")
        if total_canal is not None and valor > total_canal:
            raise ErrorDeAjuste(f"El valor supera el total del canal {canal} ({_con_unidad(total_canal, unidad)}).")

        def cambio():
            ajuste = Ajuste("fijar", f"{sku} × {canal} = {_con_unidad(valor.quantize(paso), unidad)}", autor, cuando, motivo)
            self._fijas[unidad][(sku, canal)] = Fijada(valor.quantize(paso), ajuste)
            return ajuste
        self._aplicar(cambio)

    def desfijar(self, unidad: str, sku: str, canal: str, autor: str, cuando: datetime, motivo: str) -> None:
        motivo = _motivo(motivo)
        self._unidad(unidad)
        if (sku, canal) not in self._fijas[unidad]:
            raise ErrorDeAjuste(f"La celda {sku} × {canal} no está fijada en {unidad}.")
        def cambio():
            del self._fijas[unidad][(sku, canal)]
            return Ajuste("desfijar", f"{sku} × {canal} en {'kilos' if unidad == 'kilos' else 'pesos'}", autor, cuando, motivo)
        self._aplicar(cambio)

    def elegir_fila(self, sku: str, fila: int, autor: str, cuando: datetime, motivo: str) -> None:
        """Un SKU repetido en el objetivo de Contraloría: cuál de sus filas vale."""
        motivo = _motivo(motivo)
        o = (self._e.objetivos or {}).get(sku)
        if o is None or not o.alternativas:
            raise ErrorDeAjuste(f"El SKU {sku} no está repetido en el objetivo de Contraloría.")
        filas = [x.fila for x in [o, *o.alternativas]]
        if fila not in filas:
            raise ErrorDeAjuste(f"El SKU {sku} está en las filas {', '.join(map(str, filas))}, no en la {fila}.")

        def cambio():
            ajuste = Ajuste("elegir_fila", f"{sku}: vale la fila {fila} del objetivo de Contraloría", autor, cuando,
                            motivo)
            self.filas_elegidas[sku] = (fila, ajuste)
            return ajuste
        self._aplicar(cambio)

    def elegir_canales(self, sku: str, canales, autor: str, cuando: datetime, motivo: str) -> None:
        """En qué canales se vende un SKU (el nuevo sin historia, o para limitar uno que ya tenía)."""
        motivo = _motivo(motivo)
        if self._e.objetivos is None or sku not in self._e.objetivos:
            raise ErrorDeAjuste(f"El SKU {sku} no está en el objetivo de Contraloría.")
        pedidos = [c for c in (canales or []) if c and c.strip()]
        if not pedidos:
            raise ErrorDeAjuste("Elegí al menos un canal.")
        por_nombre = {normalizar(c): c for c in (self._e.canales or {})}
        faltan = [c for c in pedidos if normalizar(c) not in por_nombre]
        if faltan:
            raise ErrorDeAjuste(f"No están en los totales por canal: {', '.join(faltan)}.")
        elegidos = frozenset(por_nombre[normalizar(c)] for c in pedidos)

        def cambio():
            ajuste = Ajuste("elegir_canales", f"{sku} se vende en {', '.join(sorted(elegidos))}", autor, cuando, motivo)
            self.canales_sku[sku] = (elegidos, ajuste)
            return ajuste
        self._aplicar(cambio)

    def quitar_canales(self, sku: str, autor: str, cuando: datetime, motivo: str) -> None:
        motivo = _motivo(motivo)
        if sku not in self.canales_sku:
            raise ErrorDeAjuste(f"Para el SKU {sku} no se eligió dónde se vende.")

        def cambio():
            del self.canales_sku[sku]
            return Ajuste("quitar_canales", f"{sku}: vuelve a los canales del mes anterior", autor, cuando, motivo)
        self._aplicar(cambio)

    def _se_vende(self, sku: str, canal: str) -> bool:
        """Por lo que dijo el planner, si lo dijo; si no, por el mes anterior."""
        if sku in self.canales_sku:
            return canal in self.canales_sku[sku][0]
        return (sku, canal) in self._e.base

    def objetivos_vigentes(self) -> dict | None:
        """El objetivo de cada SKU con las filas elegidas donde estaba repetido."""
        if self._e.objetivos is None:
            return None
        vigentes = {}
        for sku, o in self._e.objetivos.items():
            fila = self.filas_elegidas.get(sku, (o.fila, None))[0]
            vigentes[sku] = next(x for x in [o, *o.alternativas] if x.fila == fila)
        return vigentes

    # --- reglas -------------------------------------------------------------

    def agregar_regla(self, canal: str, categorias, limite: str, kilos: str | None, nns: str | None,
                      autor: str, cuando: datetime, motivo: str) -> str:
        motivo = _motivo(motivo)
        id_ = f"R{self._proxima_regla}"
        regla = _regla(id_, canal, categorias, limite, kilos, nns)

        def cambio():
            self._proxima_regla += 1
            ajuste = Ajuste("agregar_regla", _describir(regla), autor, cuando, motivo)
            self.reglas[id_] = ReglaCargada(regla, ajuste)
            return ajuste
        self._aplicar(cambio)
        return id_

    def editar_regla(self, id_: str, canal: str, categorias, limite: str, kilos: str | None, nns: str | None,
                     autor: str, cuando: datetime, motivo: str) -> None:
        motivo = _motivo(motivo)
        if id_ not in self.reglas:
            raise ErrorDeAjuste(f"No hay ninguna regla {id_}.")
        regla = _regla(id_, canal, categorias, limite, kilos, nns)

        def cambio():
            ajuste = Ajuste("editar_regla", _describir(regla), autor, cuando, motivo)
            self.reglas[id_] = ReglaCargada(regla, ajuste)
            return ajuste
        self._aplicar(cambio)

    def eliminar_regla(self, id_: str, autor: str, cuando: datetime, motivo: str) -> None:
        motivo = _motivo(motivo)
        if id_ not in self.reglas:
            raise ErrorDeAjuste(f"No hay ninguna regla {id_}.")

        def cambio():
            regla = self.reglas.pop(id_).regla
            return Ajuste("eliminar_regla", _describir(regla), autor, cuando, motivo)
        self._aplicar(cambio)

    # --- interno ------------------------------------------------------------

    def _unidad(self, unidad: str) -> int:
        if unidad not in UNIDADES:
            raise ErrorDeAjuste(f"Unidad desconocida: {unidad}. Usar kilos o plata.")
        return UNIDADES[unidad]

    def _exigir_recorrido(self) -> Recorrido:
        if self.recorrido is None:
            raise ErrorDeAjuste(f"Falta cargar: {', '.join(self.faltan())}.")
        return self.recorrido

    def _aplicar(self, cambio) -> None:
        """
        Aplica un cambio como transacción: si recalcular falla, el estado vuelve a como
        estaba antes y no queda nada a medias. Si sale bien, va al historial.
        """
        respaldo = (copy.copy(self._e), dict(self.apagados_skus), dict(self.entidades_apagadas),
                    {u: dict(f) for u, f in self._fijas.items()}, dict(self.reglas), self._proxima_regla,
                    dict(self.filas_elegidas), dict(self.canales_sku), self.recorrido)
        try:
            ajuste = cambio()
            self.recorrido = self._recalcular()
        except Exception:
            (self._e, self.apagados_skus, self.entidades_apagadas, self._fijas, self.reglas,
             self._proxima_regla, self.filas_elegidas, self.canales_sku, self.recorrido) = respaldo
            raise
        self.historial.append(ajuste)

    def _fijas_vigentes(self, unidad: str) -> dict[Celda, Decimal]:
        """
        Las celdas fijadas que aplican con las entradas y el ON/OFF actuales. Las de un
        SKU apagado o que ya no está quedan en espera: vuelven si el SKU se prende.
        """
        e, objetivos = self._e, self.objetivos_vigentes()
        return {
            (sku, canal): f.valor for (sku, canal), f in self._fijas[unidad].items()
            if sku in objetivos and sku not in self.apagados_skus and objetivos[sku].kilos > 0
            and canal in e.canales and self._se_vende(sku, canal)
        }

    def _recalcular(self) -> Recorrido | None:
        if self.faltan():
            return None
        try:
            # Un repetido ya resuelto no se vuelve a informar: la decisión quedó en el historial.
            problemas1 = [p for p in self._e.problemas1
                          if not (p.tipo == "sku_repetido" and p.sku in self.filas_elegidas)]
            return armar(
                self.objetivos_vigentes(),
                self._e.canales,
                self._e.base,
                apagados=set(self.apagados_skus),
                fijas_kilos=self._fijas_vigentes("kilos"),
                fijas_plata=self._fijas_vigentes("plata"),
                problemas=problemas1 + self._e.problemas2 + self._e.problemas_base,
                apertura=self._e.apertura,
                entidades_apagadas=set(self.entidades_apagadas),
                reglas=[r.regla for r in self.reglas.values()],
                canales_sku={k: c for k, (c, _) in self.canales_sku.items()},
            )
        except ErrorDeCruce as e:
            raise ErrorDeAjuste(str(e)) from e


def _con_unidad(valor: Decimal, unidad: str) -> str:
    return f"{a_texto(valor)} kg" if unidad == "kilos" else f"$ {a_texto(valor)}"


_NOMBRE_LIMITE = {"tope": "tope", "minimo": "mínimo", "fijo": "fijo"}


def _regla(id_, canal, categorias, limite, kilos, nns) -> Regla:
    """Valida lo que cargó el planner. Una regla que se puede leer pero no cumplir no es un error."""
    canal = (canal or "").strip()
    if not canal:
        raise ErrorDeAjuste("La regla necesita un canal.")
    categorias = frozenset(c.strip() for c in (categorias or []) if c and c.strip())
    if not categorias:
        raise ErrorDeAjuste("La regla necesita al menos una categoría.")
    if limite not in LIMITES:
        raise ErrorDeAjuste(f"Límite desconocido: {limite}. Usar tope, mínimo o fijo.")
    pct_kilos, pct_nns = _porcentaje(kilos, "kilos"), _porcentaje(nns, "NNS")
    if pct_kilos is None and pct_nns is None:
        raise ErrorDeAjuste("La regla necesita un % para kilos, para NNS o para los dos.")
    return Regla(id_, canal, categorias, limite, pct_kilos, pct_nns)


def _porcentaje(texto: str | None, unidad: str) -> Decimal | None:
    if texto is None or not str(texto).strip():
        return None  # en esa unidad la regla no aplica
    valor = numero(str(texto).replace("%", ""))
    if valor is None:
        raise ErrorDeAjuste(f"El % de {unidad} ('{texto}') no es un número.")
    if not 0 <= valor <= 100:
        raise ErrorDeAjuste(f"El % de {unidad} tiene que estar entre 0 y 100.")
    return valor


def _describir(r: Regla) -> str:
    partes = [f"{a_texto(p)}% {u}" for p, u in ((r.kilos, "kilos"), (r.nns, "NNS")) if p is not None]
    return f"{r.id}: {r.canal} · {' + '.join(sorted(r.categorias))} · {_NOMBRE_LIMITE[r.limite]} {' y '.join(partes)}"


def _motivo(motivo: str | None) -> str:
    texto = (motivo or "").strip()
    if not texto:
        raise ErrorDeAjuste("Todo ajuste necesita un motivo: queda en el historial.")
    return texto


def _leer(lector, origen):
    """Lee una entrada; si no se puede, falla sin tocar lo que ya estaba cargado."""
    try:
        return lector(origen)
    except ErrorDeEntrada as e:
        raise ErrorDeAjuste(str(e)) from e
