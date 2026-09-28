"""
El árbol debajo del canal: cómo se abre una celda SKU × canal entre
distribuidores y vendedores, con `repartir` en cada nivel.

FORMA
-----
La raíz trae el valor de la celda del cruce (no se toca). Cada nodo es una entidad
(territorio, distribuidor, vendedor...) con un peso relativo a sus hermanos. La
profundidad la define cada rama: no hay niveles fijos, no hay nombres de canal en
el código.

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
con un aviso, y el planner decide. Validar una edición (negativa, mayor que el
padre) es de quien fija el valor.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from .reparto import ErrorDeReparto, cuadra, repartir

# Unidad -> decimales. Kilos a gramo, NNS a centavo.
UNIDADES = {"kilos": 3, "nns": 2}


@dataclass
class Valor:
    monto: Decimal = Decimal(0)
    fijado: Decimal | None = None  # lo que puso el planner; None = calculado

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
class Problema:
    """Un problema de calidad del archivo de entrada."""
    severidad: str  # "error" | "aviso"
    mensaje: str
    sku: str | None = None
    bloque: str | None = None
    tipo: str | None = None  # para los que la pantalla ofrece resolver, p. ej. "sku_repetido"
    canal: str | None = None  # si es de una celda SKU × canal (p. ej. una apertura que no se puede hacer)


# ---------------------------------------------------------------------------
# Recálculo
# ---------------------------------------------------------------------------

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
    if nodo.hijos and not activos and total > 0:
        # Sin ningún hijo prendido el volumen no llega a nadie: se avisa, no queda en silencio.
        aviso = "No hay entidades prendidas entre las cuales repartir: están todas apagadas."
    elif libres and nodo.error:
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
