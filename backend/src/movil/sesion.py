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

# Revisión por etapa, en orden. Un cambio en una etapa borra el OK de esa y de las siguientes.
ETAPAS = ("canal", "apertura")
_NOMBRE_ETAPA = {"canal": "por canal", "apertura": "debajo del canal"}
# Los ajustes que solo tocan debajo del canal; todos los demás cambian el reparto por canal.
_DEBAJO_DEL_CANAL = {"apagar_entidad", "prender_entidad", "porcentaje", "agregar_entidad", "eliminar_entidad"}


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
        # Base de cálculo: (canal, entidad) -> (% manual, quién lo decidió). Sin entrada = histórico.
        self.porcentajes: dict[tuple[str, str], tuple[Decimal, Ajuste]] = {}
        # Altas: (canal, entidad) que no está en la apertura del mes anterior -> quién la sumó.
        self.entidades_nuevas: dict[tuple[str, str], Ajuste] = {}
        self._proxima_regla = 1  # los ids no se reusan: el historial los nombra
        self.historial: list[Ajuste] = []
        self.recorrido: Recorrido | None = None
        # El último cambio y el estado de antes, para deshacerlo. Una sola vez: después queda en None.
        self._antes_del_ultimo: tuple | None = None
        self.ultimo_cambio: Ajuste | None = None
        # Aprobado: quién y cuándo. Mientras no sea None, el móvil es de solo lectura.
        self.aprobado: Ajuste | None = None
        # Etapa -> quién le dio el OK. Aprobar exige las que aplican (supuesto B3).
        self.revisadas: dict[str, Ajuste] = {}

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

    def quitar_input2(self, autor: str, cuando: datetime) -> None:
        """Saca los totales por canal: para volver a armarlos en la pantalla desde el mes anterior."""
        def cambio():
            self._e.canales, self._e.problemas2, self._e.archivo2 = None, [], None
            return Ajuste("quitar_input2", "Sacó los totales por canal", autor, cuando)
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
        existentes = {e for pesos in self._e.apertura.values() for e in pesos} | {e for _, e in self.entidades_nuevas}
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

    def asignar_porcentaje(self, canal: str, entidad: str, porcentaje: str | None, autor: str, cuando: datetime,
                           motivo: str) -> None:
        """
        Base de cálculo de una entidad en un canal: un % manual (vale para todos los SKUs
        del canal, en kilos y en pesos) o, con `porcentaje` vacío, el histórico.
        """
        motivo = _motivo(motivo)
        canal = self._canal(canal)
        if entidad not in self._en_el_canal(canal):
            raise ErrorDeAjuste(f"{entidad} no está en la apertura de {canal}.")
        valor = self._validar_porcentaje(canal, entidad, porcentaje)
        if valor is None and (canal, entidad) in self.entidades_nuevas:
            raise ErrorDeAjuste(f"{entidad} es nueva y no tiene historia: necesita un %. Para sacarla, eliminala.")
        if valor is None and (canal, entidad) not in self.porcentajes:
            raise ErrorDeAjuste(f"{entidad} ya va por histórico en {canal}.")

        def cambio():
            detalle = f"{entidad} en {canal}: " + (f"{a_texto(valor)}%" if valor is not None else "por histórico")
            ajuste = Ajuste("porcentaje", detalle, autor, cuando, motivo)
            if valor is None:
                self.porcentajes.pop((canal, entidad), None)
            else:
                self.porcentajes[(canal, entidad)] = (valor, ajuste)
            return ajuste
        self._aplicar(cambio)

    def agregar_entidad(self, canal: str, entidad: str, porcentaje: str | None, autor: str, cuando: datetime,
                        motivo: str) -> None:
        """
        Alta de un vendedor o distribuidor en un canal que se abre (supuesto B2). No tiene
        historia: entra con un % manual, en todas las celdas del canal que se abren.
        """
        motivo = _motivo(motivo)
        canal = self._canal(canal)
        entidad = " ".join((entidad or "").split())
        if not entidad:
            raise ErrorDeAjuste("Falta el nombre del distribuidor o vendedor.")
        if not self._se_abre(canal):
            raise ErrorDeAjuste(f"{canal} no se abre debajo del canal: no tiene distribuidores ni vendedores.")
        # El ON/OFF es por nombre en todos los canales: dos con el mismo nombre se apagarían juntos.
        donde = sorted({c for c, e in self._todas_las_entidades() if normalizar(e) == normalizar(entidad)})
        if donde:
            raise ErrorDeAjuste(f"Ya hay un distribuidor o vendedor llamado {entidad} (en {', '.join(donde)}). "
                                f"Usá otro nombre para distinguirlos.")
        valor = _porcentaje(porcentaje, "la entidad")
        if valor is None or valor == 0:
            raise ErrorDeAjuste(f"{entidad} es nueva y no tiene historia: necesita un % mayor que 0 para recibir algo.")
        valor = self._validar_porcentaje(canal, entidad, porcentaje)

        def cambio():
            ajuste = Ajuste("agregar_entidad", f"{entidad} en {canal}: {a_texto(valor)}%", autor, cuando, motivo)
            self.entidades_nuevas[(canal, entidad)] = ajuste
            self.porcentajes[(canal, entidad)] = (valor, ajuste)
            return ajuste
        self._aplicar(cambio)

    def eliminar_entidad(self, canal: str, entidad: str, autor: str, cuando: datetime, motivo: str) -> None:
        """Saca una entidad dada de alta en la herramienta. Las del archivo se apagan, no se eliminan."""
        motivo = _motivo(motivo)
        canal = self._canal(canal)
        if (canal, entidad) not in self.entidades_nuevas:
            raise ErrorDeAjuste(f"{entidad} viene del mes anterior: no se elimina, se apaga.")

        def cambio():
            del self.entidades_nuevas[(canal, entidad)]
            self.porcentajes.pop((canal, entidad), None)
            self.entidades_apagadas.pop(entidad, None)  # el nombre es único: no prende a nadie más
            return Ajuste("eliminar_entidad", f"{entidad} en {canal}", autor, cuando, motivo)
        self._aplicar(cambio)

    def _se_abre(self, canal: str) -> bool:
        return any(normalizar(c) == normalizar(canal) for _, c in self._e.apertura)

    def _todas_las_entidades(self) -> set[tuple[str, str]]:
        """(canal, entidad) de la apertura del mes anterior y de las altas."""
        return {(c, e) for (_, c), pesos in self._e.apertura.items() for e in pesos} | set(self.entidades_nuevas)

    def _en_el_canal(self, canal: str) -> set[str]:
        """Las entidades del canal: las de la apertura del mes anterior y las dadas de alta."""
        return {e for c, e in self._todas_las_entidades() if normalizar(c) == normalizar(canal)}

    def _validar_porcentaje(self, canal: str, entidad: str, porcentaje: str | None) -> Decimal | None:
        valor = _porcentaje(porcentaje, "la entidad")
        if valor is None:
            return None
        if valor == 0:
            raise ErrorDeAjuste("El % tiene que ser mayor que 0. Para que no reciba nada, apagala.")
        otros = sum((p for (c, e), (p, _) in self.porcentajes.items() if c == canal and e != entidad), Decimal(0))
        if otros + valor > 100:
            raise ErrorDeAjuste(f"Los % de {canal} sumarían {a_texto(otros + valor)}%: no pueden pasar de 100.")
        return valor

    def _canal(self, canal: str) -> str:
        """El canal con el nombre de los totales por canal: "cordoba" es "Córdoba"."""
        por_nombre = {normalizar(c): c for c in (self._e.canales or {})}
        if normalizar(canal) not in por_nombre:
            raise ErrorDeAjuste(f"{canal} no está en los totales por canal.")
        return por_nombre[normalizar(canal)]

    def _porcentajes_vigentes(self) -> tuple[dict[tuple[str, str], Decimal], list[Problema]]:
        """
        Los % que aplican con las entradas actuales. Uno cuyo canal o entidad ya no está
        (se volvió a cargar el input 2 o la base) no se aplica y se avisa, no se pierde en silencio.
        """
        vigentes, avisos = {}, []
        for (canal, entidad), (valor, _) in sorted(self.porcentajes.items()):
            if canal in (self._e.canales or {}) and self._se_abre(canal) and entidad in self._en_el_canal(canal):
                vigentes[(canal, entidad)] = valor
            else:
                avisos.append(Problema("aviso", f"El {a_texto(valor)}% de {entidad} en {canal} no se aplica: ya no está en "
                                                f"los totales por canal o en el mes anterior. Revisalo en la apertura.",
                                       bloque="apertura", canal=canal))
        return vigentes, avisos

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

    # --- revisión por etapa -------------------------------------------------

    def etapas(self) -> tuple[str, ...]:
        """Las que aplican: si ningún canal se abre debajo, solo la etapa por canal."""
        return ETAPAS if self.recorrido is not None and self.recorrido.aperturas else ETAPAS[:1]

    def revisar_etapa(self, etapa: str, autor: str, cuando: datetime) -> None:
        """El OK del planner a una etapa. En orden: la anterior tiene que estar revisada."""
        self._exigir_borrador()
        if etapa not in self.etapas():
            raise ErrorDeAjuste(f"No hay una etapa {etapa} para revisar.")
        if not self._cierra():
            raise ErrorDeAjuste("Para dar por revisada una etapa, kilos y pesos tienen que cerrar.")
        if etapa in self.revisadas:
            raise ErrorDeAjuste(f"La etapa {_NOMBRE_ETAPA[etapa]} ya está revisada.")
        if etapa == "apertura" and "canal" not in self.revisadas:
            raise ErrorDeAjuste("Primero revisá la etapa por canal: lo de abajo sale de ahí.")
        antes = self._respaldo()
        self.revisadas[etapa] = Ajuste("revisar_etapa", f"Revisó la etapa {_NOMBRE_ETAPA[etapa]}", autor, cuando)
        self.historial.append(self.revisadas[etapa])
        # Es lo último que hizo el planner: Deshacer saca este OK y nada más.
        self._antes_del_ultimo, self.ultimo_cambio = antes, self.revisadas[etapa]

    def _invalidar_etapas(self, accion: str) -> None:
        desde = "apertura" if accion in _DEBAJO_DEL_CANAL else "canal"
        for etapa in ETAPAS[ETAPAS.index(desde):]:
            self.revisadas.pop(etapa, None)

    def _cierra(self) -> bool:
        r = self.recorrido
        return not (r is None or r.kilos.celdas is None or r.plata is None or r.plata.celdas is None)

    # --- aprobación ---------------------------------------------------------

    def aprobar(self, autor: str, cuando: datetime) -> None:
        """Solo si kilos y pesos cierran. Desde acá el móvil es de solo lectura."""
        self._exigir_borrador()
        if not self._cierra():
            raise ErrorDeAjuste("Para aprobar, kilos y pesos tienen que cerrar.")
        faltan = [e for e in self.etapas() if e not in self.revisadas]
        if faltan:
            raise ErrorDeAjuste(f"Falta revisar la etapa {' y la '.join(_NOMBRE_ETAPA[e] for e in faltan)}.")
        self.aprobado = Ajuste("aprobar", "Aprobó el móvil", autor, cuando)
        self.historial.append(self.aprobado)
        self._antes_del_ultimo = self.ultimo_cambio = None  # aprobar no se deshace

    def reabrir(self, autor: str, cuando: datetime, motivo: str) -> None:
        """Vuelve a borrador para poder cambiarlo (supuesto, A16: se puede reabrir)."""
        motivo = _motivo(motivo)
        if self.aprobado is None:
            raise ErrorDeAjuste("El móvil no está aprobado: ya se puede cambiar.")
        self.aprobado = None
        self.historial.append(Ajuste("reabrir", "Volvió el móvil a borrador", autor, cuando, motivo))

    def _exigir_borrador(self) -> None:
        if self.aprobado is not None:
            raise ErrorDeAjuste("El móvil está aprobado: para cambiarlo, reabrilo.")

    # --- deshacer -----------------------------------------------------------

    def deshacer(self, autor: str, cuando: datetime) -> None:
        """
        Vuelve al estado de antes del último cambio. No borra el historial: suma un
        ajuste "deshacer". Una sola vez; se habilita de nuevo con el próximo cambio.
        """
        if self.ultimo_cambio is None:
            raise ErrorDeAjuste("No hay ningún cambio para deshacer.")
        proxima = self._proxima_regla  # ponytail: los ids de regla no se reusan, el historial los nombra
        self._restaurar(self._antes_del_ultimo)
        self._proxima_regla = proxima
        self.historial.append(Ajuste("deshacer", f"Deshizo: {self.ultimo_cambio.detalle}", autor, cuando))
        self._antes_del_ultimo = self.ultimo_cambio = None

    # --- interno ------------------------------------------------------------

    def _respaldo(self) -> tuple:
        return (copy.copy(self._e), dict(self.apagados_skus), dict(self.entidades_apagadas),
                {u: dict(f) for u, f in self._fijas.items()}, dict(self.reglas), self._proxima_regla,
                dict(self.filas_elegidas), dict(self.canales_sku), dict(self.porcentajes), dict(self.entidades_nuevas), dict(self.revisadas), self.recorrido)

    def _restaurar(self, respaldo: tuple) -> None:
        (self._e, self.apagados_skus, self.entidades_apagadas, self._fijas, self.reglas,
         self._proxima_regla, self.filas_elegidas, self.canales_sku, self.porcentajes, self.entidades_nuevas, self.revisadas, self.recorrido) = respaldo

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
        self._exigir_borrador()
        respaldo = self._respaldo()
        try:
            ajuste = cambio()
            self.recorrido = self._recalcular()
        except Exception:
            self._restaurar(respaldo)
            raise
        self.historial.append(ajuste)
        self._invalidar_etapas(ajuste.accion)
        self._antes_del_ultimo, self.ultimo_cambio = respaldo, ajuste

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
            porcentajes, avisos_porcentaje = self._porcentajes_vigentes()
            return armar(
                self.objetivos_vigentes(),
                self._e.canales,
                self._e.base,
                apagados=set(self.apagados_skus),
                fijas_kilos=self._fijas_vigentes("kilos"),
                fijas_plata=self._fijas_vigentes("plata"),
                problemas=problemas1 + self._e.problemas2 + self._e.problemas_base + avisos_porcentaje,
                apertura=self._e.apertura,
                entidades_apagadas=set(self.entidades_apagadas),
                reglas=[r.regla for r in self.reglas.values()],
                canales_sku={k: c for k, (c, _) in self.canales_sku.items()},
                porcentajes=porcentajes,
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
