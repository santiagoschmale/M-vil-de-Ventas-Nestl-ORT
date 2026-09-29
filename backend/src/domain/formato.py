"""
Cómo se escriben los montos en los mensajes al planner: formato argentino.
Lo usan el dominio, el importador y la sesión para armar los textos que ve la pantalla.
"""

from decimal import Decimal


def a_texto(valor: Decimal) -> str:
    """
    Decimal -> "1.234.567,890": cómo se escribe un monto en los mensajes al planner.
    Con punto decimal, "10.000" se lee diez mil en Argentina.
    """
    entero, _, decimales = f"{abs(valor):f}".partition(".")
    miles = f"{int(entero):,}".replace(",", ".")
    return f"{'-' if valor < 0 else ''}{miles}{',' + decimales if decimales else ''}"
