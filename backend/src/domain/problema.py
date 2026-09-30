"""
Un problema en los datos: lo que el importador o el reparto detectan y la pantalla
muestra en "Para revisar" (SKU repetido, producto de otro país, una celda que no se
puede abrir entre vendedores...). Se informa; no se corrige solo.
"""

from dataclasses import dataclass


@dataclass
class Problema:
    """Un problema de calidad del archivo de entrada."""
    severidad: str  # "error" | "aviso"
    mensaje: str
    sku: str | None = None
    bloque: str | None = None
    tipo: str | None = None  # para los que la pantalla ofrece resolver, p. ej. "sku_repetido"
    canal: str | None = None  # si es de una celda SKU × canal (p. ej. una apertura que no se puede hacer)
