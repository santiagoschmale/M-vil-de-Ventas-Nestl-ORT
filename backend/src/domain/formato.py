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


def cantidad(valor: Decimal, decimales: int) -> str:
    """
    Un monto con su unidad, como lo lee el planner: "1.234,500 kg" o "$ 1.234,50". Si es menos de
    uno, también en gramos o centavos ("0,100 kg (100 gramos)"): con tantos ceros, cuesta leerlo.
    ponytail: la unidad sale de los decimales (3 = kilos, 2 = pesos), que es como el dominio las distingue.
    """
    texto = f"{a_texto(valor)} kg" if decimales == 3 else f"$ {a_texto(valor)}"
    if 0 < abs(valor) < 1:
        menores = int(abs(valor).scaleb(decimales))
        nombre = ("gramo" if decimales == 3 else "centavo") + ("" if menores == 1 else "s")
        texto += f" ({menores} {nombre})"
    return texto


MESES = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
         "noviembre", "diciembre")


def nombre_mes(mes: str) -> str:
    """ "2026-10" -> "octubre 2026": como lo dice el planner. Lo mismo que `nombreMes` del front. """
    anio, m = mes.split("-")
    return f"{MESES[int(m) - 1]} {anio}"
