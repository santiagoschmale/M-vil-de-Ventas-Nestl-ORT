"""
Tests del cruce SKU × canal.

Filas = input 1 (total por SKU, de Contraloría). Columnas = input 2 (total por
canal, del planner). Base = el reparto del mes anterior: dice dónde se vende cada
SKU y con qué proporción arrancar.

Los casos chicos están calculados a mano. Los grandes verifican las propiedades
que no se negocian: filas y columnas cierran exacto, cero forzado donde no se
vende, y la misma entrada da siempre lo mismo.
"""

from decimal import Decimal as D

from src.domain.cruce import ErrorDeCruce, _ajuste_biproporcional, cruzar


def _suma_fila(celdas, sku):
    return sum((v for (s, _), v in celdas.items() if s == sku), D(0))


def _suma_columna(celdas, canal):
    return sum((v for (_, c), v in celdas.items() if c == canal), D(0))


def _cierra(resultado, filas, columnas):
    assert resultado.celdas is not None, resultado.inconsistencias
    for sku, total in filas.items():
        assert _suma_fila(resultado.celdas, sku) == total, sku
    for canal, total in columnas.items():
        assert _suma_columna(resultado.celdas, canal) == total, canal
    return True


def _lanza_error(**kwargs):
    try:
        cruzar(**kwargs)
        return False
    except ErrorDeCruce:
        return True


# ---------------------------------------------------------------------------
# Casos calculados a mano
# ---------------------------------------------------------------------------

def test_base_uniforme_da_la_tabla_de_independencia():
    """
    Con base pareja, el ajuste da fila × columna / total:
    A: 60 × 70/100 = 42 y 60 × 30/100 = 18; B: 28 y 12.
    """
    r = cruzar(
        filas={"A": D("60"), "B": D("40")},
        columnas={"X": D("70"), "Y": D("30")},
        base={("A", "X"): D(1), ("A", "Y"): D(1), ("B", "X"): D(1), ("B", "Y"): D(1)},
        decimales=0,
    )
    assert r.inconsistencias == []
    assert r.celdas == {("A", "X"): D("42"), ("A", "Y"): D("18"), ("B", "X"): D("28"), ("B", "Y"): D("12")}


def test_si_la_base_ya_cierra_se_respeta_tal_cual():
    """El reparto del mes anterior es el punto de partida: si ya cumple, no se toca."""
    base = {("A", "X"): D("50"), ("A", "Y"): D("10"), ("B", "X"): D("20"), ("B", "Y"): D("20")}
    r = cruzar(
        filas={"A": D("60"), "B": D("40")},
        columnas={"X": D("70"), "Y": D("30")},
        base=base,
        decimales=0,
    )
    assert r.celdas == base


def test_cero_forzado_donde_el_sku_no_se_vende():
    """
    B no se vende en Y (no está en la base): esa celda no existe en el resultado y
    todo el objetivo de B va a X. Entonces A pone en Y lo que Y necesita.
    """
    r = cruzar(
        filas={"A": D("60"), "B": D("40")},
        columnas={"X": D("70"), "Y": D("30")},
        base={("A", "X"): D(1), ("A", "Y"): D(1), ("B", "X"): D(1)},
        decimales=0,
    )
    assert ("B", "Y") not in r.celdas
    assert r.celdas == {("A", "X"): D("30"), ("A", "Y"): D("30"), ("B", "X"): D("40")}


def test_aplica_con_cero_aparece_en_cero():
    """Aplica con cero: la celda existe y vale cero. No aplica: la celda no existe."""
    r = cruzar(
        filas={"A": D("10")},
        columnas={"X": D("10"), "Y": D("0")},
        base={("A", "X"): D(1), ("A", "Y"): D(0)},
        decimales=0,
    )
    assert r.celdas == {("A", "X"): D("10"), ("A", "Y"): D("0")}


def test_redondeo_controlado_cierra_filas_y_columnas():
    """
    Tres SKUs de 1 unidad en dos canales de 2 y 1. El ajuste da 2/3 y 1/3 en cada
    celda: redondear fila por fila daría 1 y 0 en todas y X quedaría en 3. El
    redondeo controlado reparte para que cierren las dos cosas.
    """
    filas = {"A": D("1"), "B": D("1"), "C": D("1")}
    columnas = {"X": D("2"), "Y": D("1")}
    base = {(s, c): D(1) for s in filas for c in columnas}
    r = cruzar(filas=filas, columnas=columnas, base=base, decimales=0)

    assert _cierra(r, filas, columnas)
    assert all(v in (D("0"), D("1")) for v in r.celdas.values())


def test_cada_celda_queda_a_menos_de_una_unidad_del_ajuste():
    """El redondeo solo elige entre el piso y el techo de cada celda: nunca se aleja más."""
    filas = {"A": D("10.001"), "B": D("7.337"), "C": D("2.662")}
    columnas = {"X": D("9.5"), "Y": D("6.25"), "Z": D("4.25")}
    base = {
        ("A", "X"): D("3"), ("A", "Y"): D("1"), ("A", "Z"): D("2"),
        ("B", "X"): D("1"), ("B", "Y"): D("5"), ("B", "Z"): D("1"),
        ("C", "X"): D("2"), ("C", "Y"): D("1"), ("C", "Z"): D("4"),
    }
    r = cruzar(filas=filas, columnas=columnas, base=base, decimales=3)
    real, _ = _ajuste_biproporcional(
        {s: int(v * 1000) for s, v in filas.items()},
        {c: int(v * 1000) for c, v in columnas.items()},
        base,
    )

    assert _cierra(r, filas, columnas)
    for celda, valor in r.celdas.items():
        assert abs(valor * 1000 - real[celda]) < 1, celda


# ---------------------------------------------------------------------------
# Inconsistencias: se informan, no se fuerzan
# ---------------------------------------------------------------------------

def test_el_ejemplo_del_cliente_distribuidores_no_puede_llegar():
    """
    Distribuidores tiene que sumar 12.000 kg, pero el SKU grande no se vende por
    Distribuidores: los que sí se venden ahí suman 5.000. No hay reparto posible.
    """
    r = cruzar(
        filas={"grande": D("20000"), "chico": D("5000")},
        columnas={"Distribuidores": D("12000"), "Mayoristas": D("13000")},
        base={
            ("grande", "Mayoristas"): D(1),
            ("chico", "Distribuidores"): D(1),
            ("chico", "Mayoristas"): D(1),
        },
    )
    assert r.celdas is None
    (inc,) = r.inconsistencias
    assert inc.tipo == "canales_sin_volumen"
    assert inc.canales == ("Distribuidores",)
    assert inc.skus == ("chico",)
    assert inc.diferencia == D("7000")
    assert "Distribuidores" in inc.mensaje


def test_totales_de_los_dos_inputs_que_no_coinciden():
    r = cruzar(
        filas={"A": D("100")},
        columnas={"X": D("60"), "Y": D("30")},
        base={("A", "X"): D(1), ("A", "Y"): D(1)},
    )
    assert r.celdas is None
    (inc,) = r.inconsistencias
    assert inc.tipo == "totales_distintos"
    assert inc.diferencia == D("10.000")


def test_sku_sin_ningun_canal_en_la_base():
    """SKU nuevo, sin reparto previo (A4): no hay regla, se informa."""
    r = cruzar(
        filas={"A": D("10"), "nuevo": D("5")},
        columnas={"X": D("15")},
        base={("A", "X"): D(1)},
    )
    assert r.celdas is None
    assert [(i.tipo, i.skus) for i in r.inconsistencias] == [("sku_sin_canal", ("nuevo",))]


def test_canal_sin_ningun_sku_en_la_base():
    r = cruzar(
        filas={"A": D("15")},
        columnas={"X": D("10"), "Y": D("5")},
        base={("A", "X"): D(1)},
    )
    assert [(i.tipo, i.canales) for i in r.inconsistencias] == [("canal_sin_sku", ("Y",))]


def test_celdas_que_tienen_que_quedar_en_cero_se_avisan():
    """
    A se vende en X e Y; B solo en X. Si B ocupa todo X, A no puede poner nada en
    X aunque tenga base ahí. Tiene solución, pero esa celda queda en cero: se avisa.
    """
    r = cruzar(
        filas={"A": D("10"), "B": D("10")},
        columnas={"X": D("10"), "Y": D("10")},
        base={("A", "X"): D(1), ("A", "Y"): D(1), ("B", "X"): D(1)},
        decimales=0,
    )
    assert r.inconsistencias == []
    assert r.celdas == {("A", "X"): D("0"), ("A", "Y"): D("10"), ("B", "X"): D("10")}
    assert any("A" in a and "X" in a for a in r.avisos)


# ---------------------------------------------------------------------------
# Celdas fijadas a mano
# ---------------------------------------------------------------------------

def test_una_celda_fijada_no_se_mueve_y_el_resto_absorbe():
    filas = {"A": D("60"), "B": D("40")}
    columnas = {"X": D("70"), "Y": D("30")}
    base = {(s, c): D(1) for s in filas for c in columnas}
    r = cruzar(filas=filas, columnas=columnas, base=base, decimales=0, fijas={("A", "Y"): D("5")})

    assert r.celdas[("A", "Y")] == D("5")
    assert _cierra(r, filas, columnas)


def test_fijar_mas_que_el_total_del_sku_es_inconsistencia():
    r = cruzar(
        filas={"A": D("10")},
        columnas={"X": D("10")},
        base={("A", "X"): D(1)},
        fijas={("A", "X"): D("11")},
    )
    assert r.celdas is None
    assert r.inconsistencias[0].tipo == "fijado_excede"


def test_no_se_puede_fijar_donde_el_sku_no_se_vende():
    assert _lanza_error(
        filas={"A": D("10")},
        columnas={"X": D("10")},
        base={("A", "X"): D(1)},
        fijas={("A", "Y"): D("1")},
    )


# ---------------------------------------------------------------------------
# Escala, determinismo y entradas inválidas
# ---------------------------------------------------------------------------

def _caso_grande():
    """55 SKUs × 9 canales con base irregular y algunos huecos, como el archivo real."""
    canales = [f"canal{j}" for j in range(9)]
    skus = [f"sku{i:02d}" for i in range(55)]
    base = {}
    for i, s in enumerate(skus):
        for j, c in enumerate(canales):
            if (i * 7 + j * 3) % 5 != 0:  # huecos: no aplica
                base[(s, c)] = D((i * 13 + j * 17) % 97 + 1)
    filas = {s: D((i * 7919) % 12000 + 100) / 10 for i, s in enumerate(skus)}
    total = sum(filas.values())
    pesos = [D(j + 3) for j in range(9)]
    columnas = {c: (total * p / sum(pesos)).quantize(D("0.001")) for c, p in zip(canales, pesos)}
    columnas[canales[-1]] += total - sum(columnas.values())  # que los dos inputs sumen igual
    return filas, columnas, base


def test_caso_del_tamanio_real_cierra_exacto():
    filas, columnas, base = _caso_grande()
    r = cruzar(filas=filas, columnas=columnas, base=base)

    assert r.inconsistencias == []
    assert _cierra(r, filas, columnas)
    assert set(r.celdas) == set(base)  # ni una celda fuera de donde se vende


def test_es_deterministico_y_no_depende_del_orden():
    filas, columnas, base = _caso_grande()
    uno = cruzar(filas=filas, columnas=columnas, base=base)
    otro = cruzar(
        filas=dict(reversed(list(filas.items()))),
        columnas=dict(reversed(list(columnas.items()))),
        base=dict(reversed(list(base.items()))),
    )
    assert uno.celdas == otro.celdas


def test_entradas_invalidas_fallan_fuerte():
    base = {("A", "X"): D(1)}
    assert _lanza_error(filas={"A": 10.0}, columnas={"X": D("10")}, base=base)
    assert _lanza_error(filas={"A": D("10")}, columnas={"X": D("-1")}, base=base)
    assert _lanza_error(filas={"A": D("10")}, columnas={"X": D("10")}, base={("A", "X"): D("-1")})
    assert _lanza_error(filas={"A": D("10.0001")}, columnas={"X": D("10.0001")}, base=base)
    assert _lanza_error(filas={"A": D("10")}, columnas={"X": D("10")}, base=base, decimales=-1)


# ---------------------------------------------------------------------------
# Propiedades sobre muchos casos generados (semilla fija: siempre los mismos)
# ---------------------------------------------------------------------------

def _casos(semilla, cantidad):
    import random

    rnd = random.Random(semilla)
    for _ in range(cantidad):
        skus = [f"s{i}" for i in range(rnd.randint(1, 5))]
        canales = [f"c{j}" for j in range(rnd.randint(1, 4))]
        base = {(s, c): D(rnd.randint(0, 9)) for s in skus for c in canales if rnd.random() < 0.7}
        yield rnd, skus, canales, base


def test_si_hay_solucion_el_cruce_la_encuentra_y_cierra_exacto():
    """Se arma una solución entera sobre las celdas con base y se le piden sus totales."""
    for rnd, skus, canales, base in _casos(2026, 300):
        solucion = {k: rnd.randint(0, 50) for k, w in base.items() if w > 0}
        filas = {s: D(sum(v for (x, _), v in solucion.items() if x == s)) for s in skus}
        columnas = {c: D(sum(v for (_, y), v in solucion.items() if y == c)) for c in canales}
        r = cruzar(filas=filas, columnas=columnas, base=base, decimales=0)
        assert r.inconsistencias == [], (base, filas, columnas, r.inconsistencias)
        assert _cierra(r, filas, columnas)
        assert set(r.celdas) == {k for k in base if k[0] in filas and k[1] in columnas}
        assert not any("no convergió" in a for a in r.avisos), (base, filas, columnas)


def test_la_factibilidad_coincide_con_la_condicion_de_hall():
    """
    Criterio independiente del algoritmo: hay reparto si y solo si, para todo
    conjunto de canales, lo que necesitan no supera lo que pueden darles los SKUs
    que se venden ahí (fuerza bruta sobre todos los subconjuntos).
    """
    from itertools import combinations

    for rnd, skus, canales, base in _casos(7, 300):
        filas = {s: D(rnd.randint(0, 30)) for s in skus}
        columnas = {c: D(rnd.randint(0, 30)) for c in canales}
        diferencia = sum(filas.values()) - sum(columnas.values())
        columnas[canales[0]] += diferencia  # mismos totales, para probar lo que decide el flujo
        if columnas[canales[0]] < 0:
            continue
        soporte = {k for k, w in base.items() if w > 0 and filas[k[0]] > 0 and columnas[k[1]] > 0}
        hall = all(
            sum(columnas[c] for c in grupo)
            <= sum(filas[s] for s in skus if any((s, c) in soporte for c in grupo))
            for n in range(1, len(canales) + 1)
            for grupo in combinations(canales, n)
        )
        r = cruzar(filas=filas, columnas=columnas, base=base, decimales=0)
        assert (r.celdas is not None) == hall, (base, filas, columnas, r.inconsistencias)
        if r.celdas is not None:
            assert _cierra(r, filas, columnas)
