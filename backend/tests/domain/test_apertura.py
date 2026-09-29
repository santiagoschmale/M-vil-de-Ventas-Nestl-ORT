"""
Tests del árbol debajo del canal: cascada de profundidad variable, ON/OFF y
valores fijados que el recálculo no pisa.

Se arman los árboles a mano, sin importador, para que cada test muestre la forma
exacta que prueba. Mismo estilo que test_reparto: `assert` plano, sin fixtures.
"""

from decimal import Decimal as D

from src.domain.apertura import Nodo, recalcular
from src.domain.reparto import cuadra


def _hoja(entidad, peso):
    return Nodo(entidad=entidad, nombre=entidad, peso=D(peso))


def _raiz(kilos="197718", nns="3934840140", inactivas=()):
    """Una celda de Soluciones: Directa -> vendedores, Distribuidores -> distribuidores."""
    raiz = Nodo(entidad="celda", nombre="200 × Soluciones", peso=D(1), hijos=[
        Nodo(entidad="canal.directa", nombre="Directa (BA)", peso=D(60), hijos=[
            _hoja("vend.v1", "0.5"), _hoja("vend.v2", "0.3"), _hoja("vend.v3", "0.2"),
        ]),
        Nodo(entidad="canal.distribuidores", nombre="Distribuidores", peso=D(40), hijos=[
            _hoja("dist.d1", "3"), _hoja("dist.d2", "2"), _hoja("dist.d3", "1"),
        ]),
    ])
    raiz.valores["kilos"].monto = D(kilos)
    raiz.valores["nns"].monto = D(nns)
    recalcular(raiz, set(inactivas))
    return raiz


def _nodo(raiz, entidad):
    return next(n for n in _todos(raiz) if n.entidad == entidad)


def _monto(raiz, entidad, unidad="kilos"):
    return _nodo(raiz, entidad).valores[unidad].monto


def _fijar(raiz, entidad, monto, unidad="kilos", inactivas=()):
    _nodo(raiz, entidad).valores[unidad].fijado = D(monto)
    recalcular(raiz, set(inactivas))


def _hojas(nodo):
    if not nodo.hijos:
        return [nodo]
    return [h for hijo in nodo.hijos for h in _hojas(hijo)]


def _todos(nodo):
    return [nodo] + [n for h in nodo.hijos for n in _todos(h)]


# ---------------------------------------------------------------------------
# Cascada
# ---------------------------------------------------------------------------

def test_cascada_las_hojas_suman_exacto_el_total_original():
    """El test de la cascada: kilos y NNS, cada uno contra su propio total."""
    raiz = _raiz()
    for unidad, total in (("kilos", D("197718")), ("nns", D("3934840140"))):
        hojas = _hojas(raiz)
        assert len(hojas) == 6
        assert sum(h.valores[unidad].monto for h in hojas) == total
        assert all(n.cuadra[unidad] for n in _todos(raiz))


def test_cada_nivel_cuadra_contra_su_padre():
    for nodo in _todos(_raiz()):
        if nodo.hijos:
            partes = {h.entidad: h.valores["kilos"].monto for h in nodo.hijos}
            assert cuadra(nodo.valores["kilos"].monto, partes)


def test_no_aplica_es_distinto_de_aplica_con_cero():
    raiz = Nodo(entidad="celda", nombre="100", peso=D(1), hijos=[
        _hoja("catering", "3"), _hoja("vending", "1"), _hoja("kam", "0"),
    ])
    raiz.valores["kilos"].monto = D("1000")
    recalcular(raiz, set())
    assert all(h.entidad != "mayoristas" for h in raiz.hijos)  # no aplica: no existe
    assert _monto(raiz, "kam") == D("0.000")  # aplica con cero
    assert _monto(raiz, "catering") == D("750.000")
    assert _monto(raiz, "vending") == D("250.000")


def test_todo_arranca_calculado():
    for nodo in _todos(_raiz())[1:]:
        assert nodo.valores["kilos"].estado == "calculado"


# ---------------------------------------------------------------------------
# ON/OFF
# ---------------------------------------------------------------------------

def test_apagar_redistribuye_entre_los_que_quedan():
    antes = _raiz()
    raiz = _raiz(inactivas={"dist.d3"})
    assert _monto(raiz, "dist.d3") == D("0.000")
    assert _monto(raiz, "dist.d1") > _monto(antes, "dist.d1")
    assert _monto(raiz, "dist.d1") + _monto(raiz, "dist.d2") == _monto(raiz, "canal.distribuidores")


def test_prender_de_nuevo_vuelve_al_reparto_original():
    raiz = _raiz(inactivas={"dist.d3"})
    recalcular(raiz, set())
    assert _monto(raiz, "dist.d1") == _monto(_raiz(), "dist.d1")


def test_apagar_un_intermedio_apaga_su_rama():
    """Sin Directa, Distribuidores absorbe todo y los vendedores quedan en cero."""
    raiz = _raiz(inactivas={"canal.directa"})
    assert _monto(raiz, "canal.distribuidores") == D("197718.000")
    assert _monto(raiz, "vend.v1") == 0
    assert raiz.cuadra["kilos"]


def test_apagar_no_mueve_lo_fijado():
    raiz = _raiz()
    _fijar(raiz, "dist.d1", "100", inactivas={"dist.d3"})
    assert _monto(raiz, "dist.d1") == D("100")


# ---------------------------------------------------------------------------
# Valor fijado: el recálculo no lo pisa
# ---------------------------------------------------------------------------

def test_un_valor_fijado_queda_y_los_hermanos_absorben():
    raiz = _raiz()
    directa = _monto(raiz, "canal.directa")
    _fijar(raiz, "vend.v1", "1000.5")
    v1 = _nodo(raiz, "vend.v1").valores["kilos"]
    assert v1.monto == D("1000.5") and v1.estado == "editado"
    assert _monto(raiz, "vend.v2") + _monto(raiz, "vend.v3") == directa - D("1000.5")


def test_fijar_kilos_no_toca_nns():
    """Supuesto A2: cada unidad se fija por separado."""
    raiz = _raiz()
    nns_antes = _monto(raiz, "vend.v1", "nns")
    _fijar(raiz, "vend.v1", "1000")
    assert _monto(raiz, "vend.v1", "nns") == nns_antes
    assert _nodo(raiz, "vend.v1").valores["nns"].estado == "calculado"


def test_fijar_un_intermedio_recalcula_su_rama_y_sus_hermanos():
    raiz = _raiz()
    _fijar(raiz, "canal.directa", "100000")
    assert _monto(raiz, "canal.distribuidores") == D("97718.000")
    assert sum(h.valores["kilos"].monto for h in _nodo(raiz, "canal.directa").hijos) == D("100000")


def test_el_recalculo_no_pisa_lo_fijado():
    """Fijar A, después B: A no se mueve. Sin esto el planner entra en loop."""
    raiz = _raiz()
    _fijar(raiz, "vend.v1", "5000")
    _fijar(raiz, "canal.directa", "100000")
    assert _monto(raiz, "vend.v1") == D("5000")
    assert _monto(raiz, "vend.v2") + _monto(raiz, "vend.v3") == D("95000")


def test_desfijar_vuelve_a_calculado():
    raiz = _raiz()
    original = _monto(raiz, "vend.v1")
    _fijar(raiz, "vend.v1", "5000")
    _nodo(raiz, "vend.v1").valores["kilos"].fijado = None
    recalcular(raiz, set())
    assert _nodo(raiz, "vend.v1").valores["kilos"].estado == "calculado"
    assert _monto(raiz, "vend.v1") == original


def test_todos_fijados_que_no_cierran_se_permite_y_marca_no_cuadra():
    """Estados intermedios: nunca se ajusta por atrás, los tres quedan como los puso."""
    raiz = _raiz()
    for entidad in ("dist.d1", "dist.d2", "dist.d3"):
        _fijar(raiz, entidad, "10")
    distribuidores = _nodo(raiz, "canal.distribuidores")
    assert [h.valores["kilos"].monto for h in distribuidores.hijos] == [D("10")] * 3
    assert distribuidores.cuadra["kilos"] is False
    assert distribuidores.cuadra["nns"] is True


def test_fijados_que_superan_al_padre_dejan_los_calculados_en_cero_con_aviso():
    raiz = _raiz()
    _fijar(raiz, "dist.d1", _monto(raiz, "canal.distribuidores"))
    _fijar(raiz, "dist.d2", "1")
    distribuidores = _nodo(raiz, "canal.distribuidores")
    assert _monto(raiz, "dist.d3") == 0
    assert distribuidores.cuadra["kilos"] is False
    assert distribuidores.aviso["kilos"]


# ---------------------------------------------------------------------------
# Problemas de datos
# ---------------------------------------------------------------------------

def test_error_de_datos_bloquea_el_reparto_automatico_pero_no_lo_fijado():
    raiz = _raiz()
    directa = _nodo(raiz, "canal.directa")
    directa.error = "Las participaciones de vendedores suman 97%, no 100%."
    recalcular(raiz, set())
    assert all(h.valores["kilos"].monto == 0 for h in directa.hijos)
    assert directa.cuadra["kilos"] is False

    total = directa.valores["kilos"].monto
    for entidad, monto in (("vend.v1", total - 2), ("vend.v2", D("1")), ("vend.v3", D("1"))):
        _fijar(raiz, entidad, monto)
    assert directa.cuadra["kilos"] is True


def test_hoja_con_error_no_cuadra_hasta_quedar_en_cero():
    """Directa con volumen y sin vendedores: ese volumen no llega a nadie."""
    raiz = _raiz()
    directa = _nodo(raiz, "canal.directa")
    directa.hijos = []
    directa.error = "Directa sin reparto previo de vendedores."
    recalcular(raiz, set())
    assert directa.cuadra["kilos"] is False
    assert directa.aviso["kilos"] == directa.error

    _fijar(raiz, "canal.directa", "0")  # todo a Distribuidores
    assert directa.cuadra["kilos"] is True
    assert _monto(raiz, "canal.distribuidores") == D("197718.000")


def test_peso_negativo_no_se_reparte_y_apagarlo_lo_resuelve():
    raiz = _raiz()
    _nodo(raiz, "dist.d3").peso = D("-5")
    recalcular(raiz, set())
    distribuidores = _nodo(raiz, "canal.distribuidores")
    assert distribuidores.cuadra["kilos"] is False
    assert "negativ" in distribuidores.aviso["kilos"].lower()

    recalcular(raiz, {"dist.d3"})
    assert distribuidores.cuadra["kilos"] is True
    assert distribuidores.aviso["kilos"] is None


def test_si_se_apagan_todos_los_hijos_se_avisa_y_no_queda_en_silencio():
    """Distribuidores sin ningún distribuidor prendido: su volumen no llega a nadie y se tiene que ver."""
    raiz = _raiz(inactivas={"dist.d1", "dist.d2", "dist.d3"})
    distribuidores = _nodo(raiz, "canal.distribuidores")
    assert distribuidores.cuadra["kilos"] is False
    assert distribuidores.aviso["kilos"] and "apagad" in distribuidores.aviso["kilos"]
