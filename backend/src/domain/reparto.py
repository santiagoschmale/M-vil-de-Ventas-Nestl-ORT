"""
Reparto de un total entre entidades, sin perder ni inventar unidades.

EL PROBLEMA
-----------
Repartir 100 entre tres partes iguales y redondear a 2 decimales da
33,33 + 33,33 + 33,33 = 99,99. Falta un centésimo. En una cascada de varios
niveles ese faltante se acumula y rompe la cuadratura, que es el requisito
central del sistema.

La solución es el método de mayor resto (largest remainder): se trunca hacia
abajo, se cuenta cuántas unidades mínimas faltan, y se reparten de a una entre
las entidades cuyo resto decimal quedó más grande.

POR QUÉ DECIMAL Y NUNCA FLOAT
-----------------------------
float no representa 0.1 de forma exacta. En una operación no se nota; en una
cascada de varios niveles los errores se acumulan y en la última etapa aparecen
diferencias imposibles de rastrear.

    >>> 0.1 + 0.2 == 0.3
    False
    >>> Decimal("0.1") + Decimal("0.2") == Decimal("0.3")
    True

Regla del proyecto: ningún float en cálculos de kilos ni de plata. Nunca.

PESOS, NO PORCENTAJES
---------------------
`repartir` recibe pesos relativos, no porcentajes que deban sumar 1.

El motivo es concreto: tres entidades con Decimal(1)/Decimal(3) cada una suman
0.9999999999999999999999999999, no 1. Si la función exigiera suma exacta, el caso
más común del sistema fallaría. Y aflojar a "suma 1 con tolerancia" contradice lo
que confirmó el cliente, que los desvíos son errores y no algo a tolerar.

Trabajando con pesos el problema desaparece: se reparte proporcionalmente a lo que
haya. Deshabilitar una entidad es sacarla del diccionario, sin renormalizar nada.

Validar que los porcentajes del Excel sumen 100% es otra cosa y vive en el
importador: ahí sí es un chequeo de calidad de dato que tiene que fallar fuerte.
"""

from decimal import Decimal
from fractions import Fraction
from math import floor
from typing import Mapping


class ErrorDeReparto(ValueError):
    """La entrada del reparto es inválida."""


def repartir(
    total: Decimal,
    pesos: Mapping[str, Decimal],
    decimales: int = 3,
) -> dict[str, Decimal]:
    """
    Reparte `total` entre las claves de `pesos`, proporcionalmente a cada peso.

    Garantiza que la suma del resultado sea EXACTAMENTE `total`.

    Args:
        total: el monto a repartir. Kilos o plata, da igual.
        pesos: {entidad: peso}. Pesos relativos, no hace falta que sumen 1.
            {'a': 1, 'b': 1} y {'a': 0.5, 'b': 0.5} dan el mismo resultado.
        decimales: precisión del resultado. 3 para kilos, 2 para plata.

    Returns:
        {entidad: monto}. La suma es exactamente `total`.

    Raises:
        ErrorDeReparto: si no hay entidades, si algún peso es negativo, si todos
            los pesos son cero, si el total es negativo, si el total tiene más
            decimales que `decimales`, si algún valor no es Decimal finito, o si
            `decimales` no es un entero >= 0.

    El reparto es DETERMINÍSTICO: la misma entrada devuelve siempre lo mismo,
    incluso cuando hay empate de restos.

    CÓMO FUNCIONA
    -------------
    Se trabaja en unidades mínimas enteras (`paso` = 0.01 para 2 decimales):

    1. exacto_i = total * peso_i / suma_de_pesos, como fracción exacta
    2. piso_i = exacto_i truncado hacia abajo. La suma de los pisos nunca supera
       el total, así que solo hay que agregar unidades, nunca quitar.
    3. faltan = total - suma(pisos), en unidades. Siempre 0 <= faltan < n.
    4. Se da una unidad a cada una de las `faltan` entidades con mayor resto
       (exacto_i - piso_i). Empate de restos: gana la clave menor (alfabético).

    Por qué Fraction y no Decimal en el paso intermedio: Decimal redondea a 28
    dígitos, así que dos restos distintos pueden quedar iguales y el desempate
    termina decidiendo algo que no era empate (ver
    test_restos_que_decimal_empataria_se_ordenan_bien). Fraction es exacta, de la
    biblioteca estándar, y nunca pasa por float. La entrada y la salida siguen
    siendo Decimal.
    """
    if type(decimales) is not int or decimales < 0:
        raise ErrorDeReparto(f"decimales tiene que ser un entero >= 0, llegó {decimales!r}.")
    _exigir_decimal(total, "total")
    for entidad, peso in pesos.items():
        _exigir_decimal(peso, f"peso de {entidad!r}")

    if not pesos:
        raise ErrorDeReparto("No hay entidades entre las cuales repartir.")
    negativos = sorted(e for e, p in pesos.items() if p < 0)
    if negativos:
        raise ErrorDeReparto(f"Pesos negativos: {negativos}.")
    fracciones = {e: Fraction(p) for e, p in pesos.items()}
    suma_pesos = sum(fracciones.values())
    if suma_pesos == 0:
        # Caso "entidad sin histórico" (A4): no hay regla, no se inventa una.
        raise ErrorDeReparto("Todos los pesos son cero: no hay base para repartir.")
    if total < 0:
        raise ErrorDeReparto(f"Total negativo: {total}.")

    total_u = Fraction(total) * 10**decimales
    if total_u.denominator != 1:
        raise ErrorDeReparto(
            f"El total {total} tiene más de {decimales} decimales: no puede cuadrar exacto."
        )

    exactos = {e: total_u * f / suma_pesos for e, f in fracciones.items()}
    pisos = {e: floor(x) for e, x in exactos.items()}
    faltan = int(total_u) - sum(pisos.values())

    # Decisión: desempate alfabético por clave. Sesgo conocido: en cada empate gana
    # siempre la misma entidad (como mucho n-1 unidades mínimas por reparto).
    # Alternativa si molesta: (-resto, -peso, clave). Ver NOTES.md.
    orden = sorted(pesos, key=lambda e: (-(exactos[e] - pisos[e]), e))
    for e in orden[:faltan]:
        pisos[e] += 1

    # Construir desde texto es exacto: scaleb() redondearía a la precisión del
    # contexto (28 dígitos) sin avisar.
    return {e: Decimal(f"{pisos[e]}E-{decimales}") for e in pesos}


def cuadra(total: Decimal, reparto: Mapping[str, Decimal]) -> bool:
    """
    Verifica que un reparto sume exactamente el total.

    Exacto a propósito: sin tolerancia ni epsilon. Con Decimal la igualdad exacta
    es alcanzable, y el cliente confirmó que los desvíos son errores.
    """
    # Suma exacta: sumar Decimal redondea a 28 dígitos y podría dar un falso "cuadra".
    return sum(Fraction(v) for v in reparto.values()) == Fraction(total)


def _exigir_decimal(valor, que: str) -> None:
    """Regla del proyecto: nada de float. Se corta en la entrada, no se convierte."""
    if not isinstance(valor, Decimal) or not valor.is_finite():
        raise ErrorDeReparto(f"El {que} tiene que ser un Decimal finito, llegó {valor!r}.")
