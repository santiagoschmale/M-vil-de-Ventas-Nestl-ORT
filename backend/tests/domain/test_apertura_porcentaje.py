"""
Base de cálculo (MUST): cada entidad reparte por histórico o por un % manual.

SUPUESTO (B1, a confirmar): el % es de lo que hay para repartir en la celda (el
total menos lo fijado a mano); lo que queda se reparte entre los que van por
histórico, según su historia.
"""

from decimal import Decimal as D

from src.domain.apertura import Nodo, recalcular


def _celda(kilos="1000", **porcentajes):
    hijos = [Nodo(entidad=e, nombre=e, peso=D(p), porcentaje=D(porcentajes[e]) if e in porcentajes else None)
             for e, p in (("ana", "1"), ("beto", "2"), ("carla", "1"))]
    raiz = Nodo(entidad="celda", nombre="Córdoba", peso=D(1), hijos=hijos)
    raiz.valores["kilos"].monto = D(kilos)
    raiz.valores["nns"].monto = D("500.00")
    return raiz


def _kilos(raiz):
    return {h.entidad: h.valores["kilos"].monto for h in raiz.hijos}


def test_con_porcentaje_se_lleva_ese_porcentaje_y_el_resto_va_por_historico():
    raiz = _celda(ana="30")
    recalcular(raiz, set())
    # Ana 30% de 1000; los 700 restantes entre beto (2) y carla (1).
    assert _kilos(raiz) == {"ana": D("300.000"), "beto": D("466.667"), "carla": D("233.333")}
    assert raiz.cuadra["kilos"] and raiz.cuadra["nns"]


def test_el_porcentaje_vale_igual_para_pesos():
    raiz = _celda(ana="30")
    recalcular(raiz, set())
    assert raiz.hijos[0].valores["nns"].monto == D("150.00")


def test_sin_porcentajes_es_el_historico_de_siempre():
    raiz = _celda()
    recalcular(raiz, set())
    assert _kilos(raiz) == {"ana": D("250.000"), "beto": D("500.000"), "carla": D("250.000")}


def test_todos_con_porcentaje_que_suman_cien():
    raiz = _celda(ana="50", beto="30", carla="20")
    recalcular(raiz, set())
    assert _kilos(raiz) == {"ana": D("500.000"), "beto": D("300.000"), "carla": D("200.000")}


def test_si_se_apaga_uno_con_porcentaje_su_parte_va_a_los_de_historico():
    raiz = _celda(ana="30")
    recalcular(raiz, {"ana"})
    assert _kilos(raiz) == {"ana": D("0.000"), "beto": D("666.667"), "carla": D("333.333")}


def test_si_todos_tienen_porcentaje_y_se_apaga_uno_los_demas_se_reescalan():
    """Igual que el histórico: la parte del apagado se reparte en proporción."""
    raiz = _celda(ana="50", beto="30", carla="20")
    recalcular(raiz, {"carla"})
    assert _kilos(raiz) == {"ana": D("625.000"), "beto": D("375.000"), "carla": D("0.000")}


def test_lo_fijado_a_mano_manda_y_el_porcentaje_es_de_lo_que_queda():
    raiz = _celda(ana="50")
    raiz.hijos[2].valores["kilos"].fijado = D("200")  # carla fijada
    recalcular(raiz, set())
    assert _kilos(raiz) == {"ana": D("400.000"), "beto": D("400.000"), "carla": D("200")}


def test_porcentajes_que_llegan_a_cien_dejan_en_cero_a_los_de_historico():
    raiz = _celda(ana="60", beto="40")
    recalcular(raiz, set())
    assert _kilos(raiz) == {"ana": D("600.000"), "beto": D("400.000"), "carla": D("0.000")}


def test_si_los_de_historico_tienen_peso_cero_la_celda_no_se_cae():
    """Antes de los %, A con historia se llevaba todo; con 30% no puede quedar en cero."""
    hijos = [Nodo(entidad="a", nombre="a", peso=D(100), porcentaje=D(30)), Nodo(entidad="z", nombre="z", peso=D(0))]
    raiz = Nodo(entidad="celda", nombre="c", peso=D(1), hijos=hijos)
    raiz.valores["kilos"].monto = D("1000")
    recalcular(raiz, set())
    assert _kilos(raiz) == {"a": D("1000.000"), "z": D("0.000")}
    assert raiz.cuadra["kilos"]


def test_los_ceros_salen_con_los_decimales_de_la_unidad():
    raiz = _celda(ana="60", beto="40")
    recalcular(raiz, set())
    assert raiz.hijos[2].valores["kilos"].monto.as_tuple().exponent == -3
    assert raiz.hijos[2].valores["nns"].monto.as_tuple().exponent == -2
