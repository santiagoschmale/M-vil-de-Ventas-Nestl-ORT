"""
El árbol del móvil: la cascada completa sobre la que opera `repartir`.

FORMA
-----
Un árbol por SKU. La raíz es el SKU y trae el objetivo del mes (no se edita: llega
cerrado de Contraloría). Cada nodo es una entidad (canal, territorio,
distribuidor, vendedor...) con un peso relativo a sus hermanos. La profundidad la
define cada rama: no hay niveles fijos, no hay nombres de canal en el código.

"No aplica" es no tener el nodo. "Aplica con cero" es tener el nodo con peso 0:
entra al reparto y recibe 0.

VALOR Y ESTADO
--------------
Cada nodo tiene un valor por unidad (kilos, NNS). El valor está calculado o
editado a mano. Lo editado queda fijo: el recálculo no lo pisa y los hermanos
calculados absorben la diferencia. Kilos y NNS se editan por separado (supuesto A2).

CUÁNDO NO CUADRA
----------------
Nunca se ajusta por atrás en silencio. Si lo fijado no cierra contra el padre, o
si un problema de datos impide repartir, el nivel queda marcado `cuadra = False`
con un aviso, y el planner decide. Lo único que se rechaza es la edición
imposible en sí misma (negativa o mayor que el padre).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

from .reparto import ErrorDeReparto, cuadra, repartir

# Unidad -> decimales. Kilos a gramo, NNS a centavo.
UNIDADES = {"kilos": 3, "nns": 2}


class ErrorDeEdicion(ValueError):
    """La edición pedida es imposible y no se aplicó."""


@dataclass
class Traza:
    """Quién tocó un valor o una entidad, cuándo y qué hizo."""
    autor: str
    cuando: datetime
    accion: str  # "editado" | "desfijado" | "deshabilitado"


@dataclass
class Valor:
    monto: Decimal = Decimal(0)
    fijado: Decimal | None = None  # lo que puso el planner; None = calculado
    traza: Traza | None = None

    @property
    def estado(self) -> str:
        return "calculado" if self.fijado is None else "editado"


@dataclass
class Nodo:
    entidad: str  # id de la entidad; único dentro del árbol de un SKU
    nombre: str
    peso: Decimal  # participación histórica, relativa a los hermanos
    hijos: list[Nodo] = field(default_factory=list)
    # Problema de datos detectado al importar que impide repartir automáticamente
    # entre los hijos. Se reporta, no se esconde con un default.
    error: str | None = None
    valores: dict[str, Valor] = field(default_factory=lambda: {u: Valor() for u in UNIDADES})
    # Resultado del último recálculo:
    activo: bool = True
    cuadra: dict[str, bool] = field(default_factory=lambda: {u: True for u in UNIDADES})
    aviso: dict[str, str | None] = field(default_factory=lambda: {u: None for u in UNIDADES})


@dataclass
class Sku:
    codigo: str
    descripcion: str
    segmento: str | None
    raiz: Nodo
    nns_iibb: Decimal | None = None  # se muestra; no se reparte (no está definido si se reparte)


@dataclass
class Entidad:
    id: str
    nombre: str
    tipo: str


@dataclass
class Problema:
    """Un problema de calidad del archivo de entrada."""
    severidad: str  # "error" | "aviso"
    mensaje: str
    sku: str | None = None
    bloque: str | None = None


@dataclass
class Movil:
    skus: dict[str, Sku]
    entidades: dict[str, Entidad] = field(default_factory=dict)
    inactivas: dict[str, Traza] = field(default_factory=dict)
    problemas: list[Problema] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Recálculo
# ---------------------------------------------------------------------------

def recalcular_todo(movil: Movil) -> None:
    for sku in movil.skus.values():
        recalcular(sku.raiz, movil.inactivas)


def recalcular(raiz: Nodo, inactivas) -> None:
    """Recalcula el árbol entero de arriba hacia abajo. La raíz no se toca."""
    raiz.activo = True
    _recalcular(raiz, inactivas)


def _recalcular(nodo: Nodo, inactivas) -> None:
    for hijo in nodo.hijos:
        hijo.activo = nodo.activo and hijo.entidad not in inactivas
    for unidad, decimales in UNIDADES.items():
        _repartir_hijos(nodo, unidad, decimales)
    for hijo in nodo.hijos:
        _recalcular(hijo, inactivas)


def _repartir_hijos(nodo: Nodo, unidad: str, decimales: int) -> None:
    cero = Decimal(f"0E-{decimales}")
    total = nodo.valores[unidad].monto
    activos = [h for h in nodo.hijos if h.activo]
    fijos = [h for h in activos if h.valores[unidad].fijado is not None]
    libres = [h for h in activos if h.valores[unidad].fijado is None]

    # Inactivo vale cero, pero conserva lo que el planner fijó: al rehabilitarlo vuelve.
    for h in nodo.hijos:
        if not h.activo:
            h.valores[unidad].monto = cero
    for h in fijos:
        h.valores[unidad].monto = h.valores[unidad].fijado

    disponible = total - sum((h.valores[unidad].monto for h in fijos), Decimal(0))
    aviso = None
    reparto = {h.entidad: cero for h in libres}
    if libres and nodo.error:
        aviso = nodo.error
    elif libres and disponible < 0:
        aviso = "Lo fijado supera el total de este nodo: no queda nada para los calculados."
    elif libres and disponible > 0:
        try:
            reparto = repartir(disponible, {h.entidad: h.peso for h in libres}, decimales)
        except ErrorDeReparto as e:
            aviso = str(e)
    # disponible == 0: los calculados reciben cero, sin necesidad de pesos.

    for h in libres:
        h.valores[unidad].monto = reparto[h.entidad]

    if not nodo.hijos:
        # Una hoja con error (p. ej. un canal con volumen y sin vendedores) tiene volumen que no
        # llega a nadie: cuadra solo si no le quedó nada asignado.
        nodo.cuadra[unidad] = nodo.error is None or total == 0
        aviso = nodo.error if not nodo.cuadra[unidad] else None
    else:
        nodo.cuadra[unidad] = cuadra(total, {h.entidad: h.valores[unidad].monto for h in activos})
    nodo.aviso[unidad] = aviso


# ---------------------------------------------------------------------------
# Operaciones del planner
# ---------------------------------------------------------------------------

def buscar(raiz: Nodo, entidad: str) -> tuple[Nodo | None, Nodo | None]:
    """Devuelve (nodo, padre). (None, None) si la entidad no está en el árbol."""
    pendientes = [(raiz, None)]
    while pendientes:
        nodo, padre = pendientes.pop()
        if nodo.entidad == entidad:
            return nodo, padre
        pendientes.extend((h, nodo) for h in nodo.hijos)
    return None, None


def editar(movil, codigo_sku, entidad, unidad, monto, autor, cuando) -> None:
    """Fija un valor a mano y recalcula el SKU. Rechaza lo imposible."""
    sku, nodo, padre = _ubicar(movil, codigo_sku, entidad, unidad)
    if not isinstance(monto, Decimal) or not monto.is_finite():
        raise ErrorDeEdicion(f"El valor tiene que ser un número decimal, llegó {monto!r}.")
    if monto < 0:
        raise ErrorDeEdicion("El valor no puede ser negativo.")
    paso = Decimal(f"1E-{UNIDADES[unidad]}")
    if monto % paso != 0:  # 1.0000 vale; 1.0001 kilos no
        raise ErrorDeEdicion(f"{unidad} admite como máximo {UNIDADES[unidad]} decimales.")
    tope = padre.valores[unidad].monto
    if monto > tope:
        raise ErrorDeEdicion(f"El valor ({monto}) supera al de {padre.nombre} ({tope}).")

    valor = nodo.valores[unidad]
    valor.fijado = monto.quantize(paso)
    valor.traza = Traza(autor, cuando, "editado")
    recalcular(sku.raiz, movil.inactivas)


def desfijar(movil, codigo_sku, entidad, unidad, autor, cuando) -> None:
    """Vuelve un valor editado a calculado."""
    sku, nodo, _ = _ubicar(movil, codigo_sku, entidad, unidad)
    valor = nodo.valores[unidad]
    if valor.fijado is None:
        return
    valor.fijado = None
    valor.traza = Traza(autor, cuando, "desfijado")
    recalcular(sku.raiz, movil.inactivas)


def cambiar_estado_entidad(movil, entidad, activa, autor, cuando) -> None:
    """
    Prende o apaga una entidad en TODOS los SKUs donde aparece. Su parte se reparte
    entre los hermanos calculados, proporcional a su peso (supuesto A1).
    """
    if entidad not in movil.entidades and not any(
        buscar(s.raiz, entidad)[0] for s in movil.skus.values()
    ):
        raise ErrorDeEdicion(f"No existe la entidad {entidad!r}.")
    if activa:
        movil.inactivas.pop(entidad, None)
    else:
        movil.inactivas[entidad] = Traza(autor, cuando, "deshabilitado")
    recalcular_todo(movil)


def _ubicar(movil, codigo_sku, entidad, unidad):
    if unidad not in UNIDADES:
        raise ErrorDeEdicion(f"Unidad desconocida: {unidad!r}.")
    sku = movil.skus.get(codigo_sku)
    if sku is None:
        raise ErrorDeEdicion(f"No existe el SKU {codigo_sku!r}.")
    nodo, padre = buscar(sku.raiz, entidad)
    if nodo is None:
        raise ErrorDeEdicion(f"La entidad {entidad!r} no está en el SKU {codigo_sku}.")
    if padre is None:
        raise ErrorDeEdicion("El objetivo del SKU llega cerrado de Contraloría: no se edita.")
    if not nodo.activo:
        raise ErrorDeEdicion(f"{nodo.nombre} está deshabilitada: no se puede editar.")
    return sku, nodo, padre


# ---------------------------------------------------------------------------
# Vista agregada
# ---------------------------------------------------------------------------

def agregado(movil: Movil) -> Nodo:
    """
    Suma de cada entidad sobre todos los SKUs, siguiendo el camino de entidades
    desde la raíz. Es una copia nueva: editarla no cambia nada. Sobre el agregado
    no se edita porque no hay regla para repartir un cambio entre SKUs.
    """
    total = Nodo(entidad="total", nombre="Total", peso=Decimal(1))
    for sku in movil.skus.values():
        _sumar(total, sku.raiz, raiz=True)
    _marcar_cuadratura(total)
    return total


def _sumar(destino: Nodo, origen: Nodo, raiz: bool = False) -> None:
    for unidad in UNIDADES:
        destino.valores[unidad].monto += origen.valores[unidad].monto
    if not raiz:
        destino.activo = destino.activo and origen.activo
    for hijo in origen.hijos:
        par = next((d for d in destino.hijos if d.entidad == hijo.entidad), None)
        if par is None:
            par = Nodo(entidad=hijo.entidad, nombre=hijo.nombre, peso=Decimal(0))
            destino.hijos.append(par)
        _sumar(par, hijo)


def _marcar_cuadratura(nodo: Nodo) -> None:
    for unidad in UNIDADES:
        nodo.cuadra[unidad] = not nodo.hijos or cuadra(
            nodo.valores[unidad].monto, {h.entidad: h.valores[unidad].monto for h in nodo.hijos}
        )
    for hijo in nodo.hijos:
        _marcar_cuadratura(hijo)
