"""
"Dónde se vende": el planner indica en qué canales se vende un SKU. Resuelve el SKU
nuevo sin historia (A4) sin apagarlo, y restringe uno que ya tenía historia ("el SKU X
solo se vende en Córdoba y Rosario", del catálogo de reglas del cliente).

SUPUESTO (A4, a confirmar): en los canales nuevos para el SKU se parte de un peso
proporcional al total de cada canal; el ajuste de siempre hace el resto. Debajo del
canal, el SKU se abre como se abrió el canal entero el mes anterior.

La muestra tal cual: el SKU nuevo tiene 10 kg y $ 125.000 que el planner ya contó en
Directa (BA).
"""

from decimal import Decimal as D
from pathlib import Path

from src.importer.entradas import leer_apertura, leer_base, leer_input1, leer_input2
from src.movil.recorrido import armar

MUESTRA = Path(__file__).parents[3] / "data" / "sample"
NUEVO = "90020900"


def _armar(canales_sku, apagados=frozenset()):
    objetivos, _ = leer_input1(MUESTRA / "input1_objetivo.xlsx")
    canales, _ = leer_input2((MUESTRA / "input2_canales.tsv").read_text(encoding="utf-8"))
    base, _ = leer_base(MUESTRA / "base_mes_anterior.xlsx")
    apertura, _ = leer_apertura(MUESTRA / "base_mes_anterior.xlsx")
    return armar(objetivos, canales, base, apagados=apagados, apertura=apertura, canales_sku=canales_sku)


def _fila(cruce, sku):
    return {k: v for (s, k), v in cruce.celdas.items() if s == sku}


def test_el_sku_nuevo_se_reparte_en_el_canal_que_dice_el_planner_y_cierra():
    r = _armar({NUEVO: {"Directa (BA)"}})
    assert r.kilos.inconsistencias == [] and r.plata.inconsistencias == []
    assert _fila(r.kilos, NUEVO) == {"Directa (BA)": D("10.000")}
    assert _fila(r.plata, NUEVO) == {"Directa (BA)": D("125000.00")}


def test_en_varios_canales_la_fila_del_sku_suma_exacto_su_objetivo():
    r = _armar({NUEVO: {"Directa (BA)", "Córdoba"}})
    assert r.kilos.inconsistencias == []
    fila = _fila(r.kilos, NUEVO)
    assert set(fila) == {"Directa (BA)", "Córdoba"} and sum(fila.values()) == D("10.000")
    for canal, t in r.canales.items():
        assert sum((v for (_, k), v in r.kilos.celdas.items() if k == canal), D(0)) == t.kilos, canal


def test_en_un_canal_que_se_abre_el_sku_nuevo_llega_a_los_vendedores():
    r = _armar({NUEVO: {"Directa (BA)"}})
    raiz = r.aperturas[(NUEVO, "Directa (BA)")]
    assert raiz.cuadra["kilos"] and len(raiz.hijos) > 1
    assert sum(h.valores["kilos"].monto for h in raiz.hijos) == D("10.000")
    assert not any(p.sku == NUEVO for p in r.problemas if p.bloque == "apertura")


def test_a_un_sku_con_historia_lo_limita_a_esos_canales():
    """ "El SKU X solo se vende en Catering": sus otros canales quedan en no aplica."""
    antes = _armar({NUEVO: {"Directa (BA)"}})
    sku = next(s for s in antes.objetivos if len(_fila(antes.kilos, s)) > 1 and "Catering" in _fila(antes.kilos, s))
    r = _armar({NUEVO: {"Directa (BA)"}, sku: {"Catering"}})
    assert set(_fila(r.kilos, sku)) == {"Catering"}


def test_un_canal_que_no_esta_en_los_totales_se_avisa_y_no_se_usa():
    r = _armar({NUEVO: {"Tucumán", "Directa (BA)"}})
    assert any(p.sku == NUEVO and "Tucumán" in p.mensaje for p in r.problemas)
    assert set(_fila(r.kilos, NUEVO)) == {"Directa (BA)"}


def test_un_sku_apagado_no_se_reparte_aunque_diga_donde_se_vende():
    r = _armar({NUEVO: {"Directa (BA)"}}, apagados={NUEVO})
    assert NUEVO not in {s for s, _ in (r.kilos.celdas or {})}
