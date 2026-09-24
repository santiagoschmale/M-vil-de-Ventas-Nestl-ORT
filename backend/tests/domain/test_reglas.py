"""
Reglas en el cruce SKU × canal.

Una regla limita cuánto de un canal se lleva un grupo de SKUs (una o más
categorías): tope, mínimo o valor fijo, en % del total del canal. Lo que
respondió el negocio (reunión de reglas):

1. No hay topes compartidos: cada regla es de un canal, con su propio %.
2. Si la regla choca con el histórico, vale la regla: se recorta y el resto se
   redistribuye, lo más parecido posible al mes anterior.
3. Si dos reglas se contradicen, no hay prioridad: se marca el conflicto.
4. Kilos y NNS son independientes (cada cruce recibe sus propios grupos).

Los casos chicos están calculados a mano; los grandes verifican que toda regla
se cumple exacto, en unidades mínimas, después del redondeo.
"""

import random
from decimal import Decimal as D
from fractions import Fraction
from math import ceil, floor

from src.domain.cruce import _REGLAS_JUSTAS, ErrorDeCruce, Grupo, cruzar

PAREJA = {("cafe", "X"): D(1), ("cafe", "Y"): D(1), ("choco", "X"): D(1), ("choco", "Y"): D(1)}
CIEN = {"cafe": D("100"), "choco": D("100")}
X_Y = {"X": D("100"), "Y": D("100")}


def _grupo(regla, canal, skus, limite, porcentaje):
    return Grupo(regla=regla, canal=canal, skus=frozenset(skus), limite=limite, porcentaje=D(porcentaje))


def _suma(celdas, canal, skus):
    return sum((v for (s, k), v in celdas.items() if k == canal and s in skus), D(0))


def _cierra(r, filas, columnas):
    assert r.celdas is not None, r.inconsistencias
    for sku, total in filas.items():
        assert sum((v for (s, _), v in r.celdas.items() if s == sku), D(0)) == total, sku
    for canal, total in columnas.items():
        assert sum((v for (_, k), v in r.celdas.items() if k == canal), D(0)) == total, canal


# ---------------------------------------------------------------------------
# La regla gana al histórico (respuesta 2)
# ---------------------------------------------------------------------------

def test_un_tope_recorta_y_el_resto_absorbe():
    """
    Sin regla, con base pareja, todo da 50. Café en X no puede pasar el 20% de X
    (20 de 100): café va 20 a X y 80 a Y; chocolate completa X con 80. En 2 × 2 con
    filas y columnas fijas hay una sola solución.
    """
    r = cruzar(CIEN, X_Y, PAREJA, decimales=3, grupos=[_grupo("R1", "X", {"cafe"}, "tope", "20")])
    assert r.inconsistencias == []
    assert r.celdas == {("cafe", "X"): D("20.000"), ("cafe", "Y"): D("80.000"),
                        ("choco", "X"): D("80.000"), ("choco", "Y"): D("20.000")}
    assert all(v.as_tuple().exponent == -3 for v in r.celdas.values())


def test_el_recorte_se_reparte_dentro_del_grupo_como_venia_el_mes_anterior():
    """
    Dos cafés (60 y 40) con base pareja y tope de 20 para café en X. El ajuste
    multiplica cada celda por un factor de fila, uno de columna y uno de la regla,
    así que dentro del grupo la proporción entre cafés se mantiene: 60/40 → 12 y 8.
    """
    filas = {"cafe1": D("60"), "cafe2": D("40"), "choco": D("100")}
    base = {(s, k): D(1) for s in filas for k in X_Y}
    r = cruzar(filas, X_Y, base, decimales=3, grupos=[_grupo("R1", "X", {"cafe1", "cafe2"}, "tope", "20")])
    assert r.celdas == {
        ("cafe1", "X"): D("12.000"), ("cafe1", "Y"): D("48.000"),
        ("cafe2", "X"): D("8.000"), ("cafe2", "Y"): D("32.000"),
        ("choco", "X"): D("80.000"), ("choco", "Y"): D("20.000"),
    }


def test_un_minimo_empuja_para_arriba():
    r = cruzar(CIEN, X_Y, PAREJA, decimales=3, grupos=[_grupo("R1", "X", {"cafe"}, "minimo", "70")])
    assert r.celdas[("cafe", "X")] == D("70.000")
    _cierra(r, CIEN, X_Y)


def test_un_valor_fijo_en_porcentaje_se_cumple_exacto():
    r = cruzar(CIEN, X_Y, PAREJA, decimales=3, grupos=[_grupo("R1", "X", {"cafe"}, "fijo", "35")])
    assert r.celdas[("cafe", "X")] == D("35.000")
    _cierra(r, CIEN, X_Y)


def test_una_regla_que_ya_se_cumple_no_cambia_nada():
    sin = cruzar(CIEN, X_Y, PAREJA, decimales=3)
    con = cruzar(CIEN, X_Y, PAREJA, decimales=3, grupos=[_grupo("R1", "X", {"cafe"}, "tope", "90"),
                                                         _grupo("R2", "Y", {"choco"}, "minimo", "10")])
    assert con.celdas == sin.celdas


# ---------------------------------------------------------------------------
# Decimales: el % se lleva a unidades mínimas sin pasarse del límite
# ---------------------------------------------------------------------------

def test_un_tope_que_no_da_justo_redondea_para_abajo_y_un_minimo_para_arriba():
    """
    33,3333% de 100 kg son 33,33333 kg: con gramos, el tope es 33,333 (no puede
    pasarse) y el mínimo 33,334 (no puede quedar corto).
    """
    tope = cruzar(CIEN, X_Y, PAREJA, decimales=3, grupos=[_grupo("R1", "X", {"cafe"}, "tope", "33.3333")])
    minimo = cruzar(CIEN, X_Y, PAREJA, decimales=3, grupos=[_grupo("R1", "X", {"cafe"}, "minimo", "66.6666")])
    assert str(tope.celdas[("cafe", "X")]) == "33.333"
    assert str(minimo.celdas[("cafe", "X")]) == "66.667"  # 66,6666 kg → 66,667, no 66,666
    _cierra(tope, CIEN, X_Y)
    _cierra(minimo, CIEN, X_Y)


def test_en_plata_el_limite_se_lleva_a_centavos():
    filas = {"cafe": D("1000.00"), "choco": D("1000.00")}
    columnas = {"X": D("1000.00"), "Y": D("1000.00")}
    r = cruzar(filas, columnas, PAREJA, decimales=2, grupos=[_grupo("R1", "X", {"cafe"}, "tope", "12.345")])
    assert str(r.celdas[("cafe", "X")]) == "123.45"
    _cierra(r, filas, columnas)


def test_un_fijo_que_no_cae_en_la_unidad_minima_se_redondea_y_se_avisa():
    r = cruzar(CIEN, X_Y, PAREJA, decimales=3, grupos=[_grupo("R1", "X", {"cafe"}, "fijo", "33.3333")])
    assert str(r.celdas[("cafe", "X")]) == "33.333"
    assert any("R1" in a and "33,333" in a for a in r.avisos)


def test_el_limite_cuenta_sobre_el_total_del_canal_aunque_haya_celdas_fijadas():
    """
    Choco en X fijado en 60: café tiene que poner los otros 40 de X. Un tope de 45%
    es 45 de los 100 de X y se cumple. Si se contara sobre los 40 libres serían 18
    y no habría solución.
    """
    r = cruzar(CIEN, X_Y, PAREJA, decimales=3, fijas={("choco", "X"): D("60")},
               grupos=[_grupo("R1", "X", {"cafe"}, "tope", "45")])
    assert r.celdas[("choco", "X")] == D("60.000")
    assert r.celdas[("cafe", "X")] == D("40.000")
    _cierra(r, CIEN, X_Y)


# ---------------------------------------------------------------------------
# Lo que no se puede cumplir se marca (respuesta 3)
# ---------------------------------------------------------------------------

def test_una_regla_imposible_con_los_datos_dice_cuanto_se_puede():
    """Café suma 50 en total: nunca puede ser el 70% de los 100 de X."""
    filas = {"cafe": D("50"), "choco": D("150")}
    r = cruzar(filas, X_Y, PAREJA, decimales=3, grupos=[_grupo("R1", "X", {"cafe"}, "minimo", "70")])
    assert r.celdas is None
    (inc,) = r.inconsistencias
    assert inc.tipo == "regla_incumplible"
    assert inc.reglas == ("R1",)
    assert "70,000" in inc.mensaje and "50,000" in inc.mensaje  # lo que pide y lo máximo posible


def test_dos_reglas_que_juntas_no_se_pueden_cumplir_se_marcan_juntas():
    """
    Café (100) en X a lo sumo 20 y en Y a lo sumo 20: solo entran 40. Cada una sola
    se puede; juntas no. No hay prioridad: se informan las dos.
    """
    reglas = [_grupo("R1", "X", {"cafe"}, "tope", "20"), _grupo("R2", "Y", {"cafe"}, "tope", "20")]
    for sola in reglas:
        assert cruzar(CIEN, X_Y, PAREJA, decimales=3, grupos=[sola]).celdas is not None
    r = cruzar(CIEN, X_Y, PAREJA, decimales=3, grupos=reglas)
    assert r.celdas is None
    (inc,) = r.inconsistencias
    assert inc.tipo == "reglas_en_conflicto"
    assert inc.reglas == ("R1", "R2")


def test_el_conflicto_informado_es_minimo_y_no_arrastra_reglas_inocentes():
    """
    Café (150) en X, Y y Z a lo sumo 40 cada uno: entran 120. De a dos se puede
    (80 + 100 del tercer canal). El conflicto son las tres; R4, sobre chocolate y
    que se cumple, no se menciona.
    """
    filas = {"cafe": D("150"), "choco": D("150")}
    columnas = {"X": D("100"), "Y": D("100"), "Z": D("100")}
    base = {(s, k): D(1) for s in filas for k in columnas}
    reglas = [_grupo(f"R{i}", k, {"cafe"}, "tope", "40") for i, k in enumerate("XYZ", 1)]
    reglas.append(_grupo("R4", "X", {"choco"}, "tope", "95"))
    r = cruzar(filas, columnas, base, decimales=3, grupos=reglas)
    (inc,) = r.inconsistencias
    assert inc.tipo == "reglas_en_conflicto"
    assert inc.reglas == ("R1", "R2", "R3")


def test_conflictos_independientes_se_informan_por_separado():
    filas = {"cafe": D("100"), "choco": D("100"), "te": D("100"), "mate": D("100")}
    columnas = {"X": D("200"), "Y": D("200")}
    base = {(s, k): D(1) for s in filas for k in columnas}
    reglas = [
        _grupo("R1", "X", {"cafe"}, "tope", "10"), _grupo("R2", "Y", {"cafe"}, "tope", "10"),
        _grupo("R3", "X", {"te"}, "tope", "10"), _grupo("R4", "Y", {"te"}, "tope", "10"),
    ]
    r = cruzar(filas, columnas, base, decimales=3, grupos=reglas)
    assert sorted(i.reglas for i in r.inconsistencias) == [("R1", "R2"), ("R3", "R4")]


def test_una_regla_que_choca_con_una_celda_fijada_lo_dice():
    r = cruzar(CIEN, X_Y, PAREJA, decimales=3, fijas={("cafe", "X"): D("50")},
               grupos=[_grupo("R1", "X", {"cafe"}, "tope", "20")])
    assert r.celdas is None
    (inc,) = r.inconsistencias
    assert inc.reglas == ("R1",)
    assert "fijad" in inc.mensaje


def test_tope_y_minimo_sobre_el_mismo_grupo_se_combinan():
    r = cruzar(CIEN, X_Y, PAREJA, decimales=3, grupos=[_grupo("R1", "X", {"cafe"}, "tope", "30"),
                                                       _grupo("R2", "X", {"cafe"}, "minimo", "20")])
    assert r.celdas[("cafe", "X")] == D("30.000")  # de 50 baja hasta el tope
    choque = cruzar(CIEN, X_Y, PAREJA, decimales=3, grupos=[_grupo("R1", "X", {"cafe"}, "tope", "20"),
                                                            _grupo("R2", "X", {"cafe"}, "minimo", "30")])
    assert [i.reglas for i in choque.inconsistencias] == [("R1", "R2")]


def test_reglas_anidadas_se_cumplen_las_dos():
    """Café ≤ 20% de X (30) y café + chocolate ≥ 80% de X (120): una categoría dentro de otra."""
    filas = {"cafe": D("100"), "choco": D("100"), "te": D("100")}
    columnas = {"X": D("150"), "Y": D("150")}
    base = {(s, k): D(1) for s in filas for k in columnas}
    reglas = [_grupo("R1", "X", {"cafe"}, "tope", "20"), _grupo("R2", "X", {"cafe", "choco"}, "minimo", "80")]
    r = cruzar(filas, columnas, base, decimales=3, grupos=reglas)
    _cierra(r, filas, columnas)
    assert _suma(r.celdas, "X", {"cafe"}) <= D("30.000")
    assert _suma(r.celdas, "X", {"cafe", "choco"}) >= D("120.000")


def test_reglas_que_se_pisan_en_parte_se_informan_y_no_se_resuelven_solas():
    """
    Café + chocolate y chocolate + té en el mismo canal comparten solo chocolate.
    Esa combinación no está soportada todavía: se informa, no se adivina.
    """
    filas = {"cafe": D("100"), "choco": D("100"), "te": D("100")}
    columnas = {"X": D("150"), "Y": D("150")}
    base = {(s, k): D(1) for s in filas for k in columnas}
    reglas = [_grupo("R1", "X", {"cafe", "choco"}, "tope", "80"), _grupo("R2", "X", {"choco", "te"}, "tope", "80")]
    r = cruzar(filas, columnas, base, decimales=3, grupos=reglas)
    assert r.celdas is None
    assert [(i.tipo, i.reglas) for i in r.inconsistencias] == [("reglas_superpuestas", ("R1", "R2"))]


def test_una_regla_sobre_skus_que_no_se_venden_en_el_canal():
    """Tope: se cumple sola (queda en 0). Mínimo mayor a 0: imposible, se informa."""
    base = {("cafe", "Y"): D(1), ("choco", "X"): D(1), ("choco", "Y"): D(1)}
    filas, columnas = {"cafe": D("50"), "choco": D("150")}, X_Y
    assert cruzar(filas, columnas, base, decimales=3, grupos=[_grupo("R1", "X", {"cafe"}, "tope", "10")]).celdas
    r = cruzar(filas, columnas, base, decimales=3, grupos=[_grupo("R1", "X", {"cafe"}, "minimo", "10")])
    assert r.inconsistencias[0].tipo == "regla_incumplible"


def test_el_orden_de_las_reglas_no_cambia_el_resultado():
    filas = {"cafe": D("100"), "choco": D("100"), "te": D("100")}
    columnas = {"X": D("150"), "Y": D("150")}
    base = {(s, k): D(i + 1) for i, (s, k) in enumerate((s, k) for s in filas for k in columnas)}
    reglas = [_grupo("R1", "X", {"cafe"}, "tope", "20"), _grupo("R2", "Y", {"te"}, "minimo", "40"),
              _grupo("R3", "X", {"cafe", "choco"}, "minimo", "60")]
    a = cruzar(filas, columnas, base, decimales=3, grupos=reglas)
    b = cruzar(dict(reversed(filas.items())), columnas, base, decimales=3, grupos=list(reversed(reglas)))
    assert a.celdas == b.celdas and a.celdas is not None


def test_grupos_invalidos_fallan_fuerte():
    for g in (_grupo("R1", "W", {"cafe"}, "tope", "20"),  # canal que no está
              _grupo("R1", "X", {"cafe"}, "tope", "120"),  # más de 100%
              _grupo("R1", "X", {"cafe"}, "tope", "-1"),
              _grupo("R1", "X", {"cafe"}, "techo", "20")):  # límite desconocido
        try:
            cruzar(CIEN, X_Y, PAREJA, decimales=3, grupos=[g])
            assert False, g
        except ErrorDeCruce:
            pass


# ---------------------------------------------------------------------------
# Propiedad: si las reglas se pueden cumplir, se cumplen exacto
# ---------------------------------------------------------------------------

def _caso_con_reglas(rnd: random.Random):
    """
    Arma un reparto entero al azar y deriva de él filas, columnas y reglas que ese
    reparto cumple: así se sabe que hay solución. Por canal, a lo sumo dos reglas
    anidadas (una categoría dentro de otra).
    """
    decimales = rnd.choice([0, 2, 3])
    skus = [f"S{i}" for i in range(rnd.randint(2, 7))]
    canales = [f"C{j}" for j in range(rnd.randint(2, 5))]
    m = {}
    for s in skus:
        for k in canales:
            if rnd.random() < 0.7:
                m[(s, k)] = rnd.randint(0, 50) * 10 ** decimales // rnd.choice([1, 3])
    for s in skus:  # que cada SKU y canal tengan al menos una celda
        m.setdefault((s, rnd.choice(canales)), rnd.randint(1, 50))
    for k in canales:
        m.setdefault((rnd.choice(skus), k), rnd.randint(1, 50))
    uni = D(1).scaleb(-decimales)
    filas = {s: sum(v for (x, _), v in m.items() if x == s) * uni for s in skus}
    columnas = {k: sum(v for (_, y), v in m.items() if y == k) * uni for k in canales}
    base = {k: D(rnd.randint(1, 9)) for k in m}
    grupos = []
    for k in canales:
        total = sum(v for (_, y), v in m.items() if y == k)
        if total == 0:
            continue
        grande = set(rnd.sample(skus, rnd.randint(1, len(skus))))
        conjuntos = [grande]
        if len(grande) > 1 and rnd.random() < 0.5:
            conjuntos.append(set(rnd.sample(sorted(grande), rnd.randint(1, len(grande) - 1))))
        for n, conjunto in enumerate(conjuntos):
            g = sum(v for (x, y), v in m.items() if y == k and x in conjunto)
            parte = Fraction(g * 100, total)  # el % exacto que ese reparto le da al grupo
            limite = rnd.choice(["tope", "minimo"])
            # 4 decimales de %: tope redondea para arriba y mínimo para abajo, así el reparto lo cumple
            pct = (ceil if limite == "tope" else floor)(parte * 10_000) / D(10_000)
            grupos.append(Grupo(f"{k}-{n}", k, frozenset(conjunto), limite, D(pct)))
    return filas, columnas, base, decimales, grupos


def test_si_las_reglas_se_pueden_cumplir_se_cumplen_exacto_despues_del_redondeo():
    rnd = random.Random(20260924)
    lejos_de_la_base = 0
    for caso in range(250):
        filas, columnas, base, decimales, grupos = _caso_con_reglas(rnd)
        r = cruzar(filas, columnas, base, decimales=decimales, grupos=grupos)
        assert r.celdas is not None, (caso, r.inconsistencias)
        _cierra(r, filas, columnas)
        uni = D(1).scaleb(-decimales)
        for g in grupos:
            total = columnas[g.canal] / uni
            limite = g.porcentaje * total / 100
            suma = _suma(r.celdas, g.canal, g.skus) / uni
            if g.limite == "tope":
                assert suma <= limite, (caso, g, suma, limite)
            else:
                assert suma >= limite, (caso, g, suma, limite)
        assert all(v.as_tuple().exponent == -decimales for v in r.celdas.values()), caso
        lejos_de_la_base += _REGLAS_JUSTAS in r.avisos
    # Con reglas al límite el ajuste puede no llegar y el reparto, que igual cumple todo,
    # se aleja de la base (se avisa). Hoy pasa en 8 de 250 casos armados al límite.
    assert lejos_de_la_base <= 12, lejos_de_la_base
