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
from src.importer.entradas import (
    KILOS,
    PLATA,
    ErrorDeEntrada,
    leer_apertura,
    leer_base,
    leer_input1,
    leer_input2,
    numero,
)
from src.domain.arbol import Problema
from src.movil.recorrido import Recorrido, armar

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
class _Entradas:
    objetivos: dict | None = None
    problemas1: list[Problema] = field(default_factory=list)
    archivo1: str | None = None
    canales: dict | None = None
    problemas2: list[Problema] = field(default_factory=list)
    texto2: str | None = None
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
        self.historial: list[Ajuste] = []
        self.recorrido: Recorrido | None = None

    # --- entradas -----------------------------------------------------------

    def faltan(self) -> list[str]:
        return [n for n, v in (("input 1", self._e.objetivos), ("input 2", self._e.canales),
                               ("base del mes anterior", self._e.base)) if v is None]

    @property
    def entradas(self) -> _Entradas:
        return self._e

    def cargar_input1(self, origen, nombre: str, autor: str, cuando: datetime) -> None:
        objetivos, problemas = _leer(leer_input1, origen)

        def cambio():
            self._e.objetivos, self._e.problemas1, self._e.archivo1 = objetivos, problemas, nombre
            return Ajuste("cargar_input1", nombre, autor, cuando)
        self._aplicar(cambio)

    def cargar_input2(self, texto: str, autor: str, cuando: datetime) -> None:
        canales, problemas = _leer(leer_input2, texto)

        def cambio():
            self._e.canales, self._e.problemas2, self._e.texto2 = canales, problemas, texto
            return Ajuste("cargar_input2", f"{len(canales)} canales", autor, cuando)
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
            raise ErrorDeAjuste(f"El SKU {sku} no está en el input 1.")
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
            raise ErrorDeAjuste(f"El canal {canal} no está en el input 2.")
        if (sku, canal) not in self._e.base:
            raise ErrorDeAjuste(f"El SKU {sku} no se vende en {canal} (no está en la base): no se puede fijar.")
        objetivo = r.objetivos[sku].kilos if unidad == "kilos" else r.objetivos[sku].nns
        total_canal = r.canales[canal].kilos if unidad == "kilos" else r.canales[canal].plata
        if objetivo is not None and valor > objetivo:
            raise ErrorDeAjuste(f"El valor supera el objetivo del SKU {sku} ({objetivo}).")
        if total_canal is not None and valor > total_canal:
            raise ErrorDeAjuste(f"El valor supera el total del canal {canal} ({total_canal}).")

        def cambio():
            ajuste = Ajuste("fijar", f"{unidad} {sku} × {canal} = {valor.quantize(paso)}", autor, cuando, motivo)
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
            return Ajuste("desfijar", f"{unidad} {sku} × {canal}", autor, cuando, motivo)
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
                    {u: dict(f) for u, f in self._fijas.items()}, self.recorrido)
        try:
            ajuste = cambio()
            self.recorrido = self._recalcular()
        except Exception:
            self._e, self.apagados_skus, self.entidades_apagadas, self._fijas, self.recorrido = respaldo
            raise
        self.historial.append(ajuste)

    def _fijas_vigentes(self, unidad: str) -> dict[Celda, Decimal]:
        """
        Las celdas fijadas que aplican con las entradas y el ON/OFF actuales. Las de un
        SKU apagado o que ya no está quedan en espera: vuelven si el SKU se prende.
        """
        e = self._e
        return {
            (sku, canal): f.valor for (sku, canal), f in self._fijas[unidad].items()
            if sku in e.objetivos and sku not in self.apagados_skus and e.objetivos[sku].kilos > 0
            and canal in e.canales and (sku, canal) in e.base
        }

    def _recalcular(self) -> Recorrido | None:
        if self.faltan():
            return None
        try:
            return armar(
                self._e.objetivos,
                self._e.canales,
                self._e.base,
                apagados=set(self.apagados_skus),
                fijas_kilos=self._fijas_vigentes("kilos"),
                fijas_plata=self._fijas_vigentes("plata"),
                problemas=self._e.problemas1 + self._e.problemas2 + self._e.problemas_base,
                apertura=self._e.apertura,
                entidades_apagadas=set(self.entidades_apagadas),
            )
        except ErrorDeCruce as e:
            raise ErrorDeAjuste(str(e)) from e


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
