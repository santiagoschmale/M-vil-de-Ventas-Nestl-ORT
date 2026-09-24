"""
Tests del árbol del móvil: cascada de profundidad variable, toggles y edición.

Se arman los árboles a mano, sin importador, para que cada test muestre la forma
exacta que prueba. Mismo estilo que test_reparto: `assert` plano, sin fixtures.
"""

from datetime import datetime
from decimal import Decimal as D

from src.domain.arbol import (
    Movil,
    Nodo,
    Sku,
    ErrorDeEdicion,
    agregado,
    buscar,
    cambiar_estado_entidad,
    desfijar,
    editar,
    recalcular_todo,
)
from src.domain.reparto import cuadra

CUANDO = datetime(2026, 9, 22, 10, 0)


def _hoja(entidad, peso):
    return Nodo(entidad=entidad, nombre=entidad, peso=D(peso))


def _movil():
    """
    SKU 100, Ingredientes: cierra en canal. Mayoristas no aplica (no está);
    KAM aplica con cero.
    SKU 200 y 300, Soluciones: Directa -> vendedores, Distribuidores -> distribuidores.
    """
    ingredientes = Sku(
        codigo="100", descripcion="Café soluble 1kg", segmento="Ingredientes",
        raiz=Nodo(entidad="sku.100", nombre="100", peso=D(1), hijos=[
            _hoja("canal.catering", "3"),
            _hoja("canal.vending", "1"),
            _hoja("canal.kam", "0"),
        ]),
    )

    def soluciones(codigo):
        return Sku(
            codigo=codigo, descripcion=f"Máquina {codigo}", segmento="Soluciones",
            raiz=Nodo(entidad=f"sku.{codigo}", nombre=codigo, peso=D(1), hijos=[
                Nodo(entidad="canal.directa", nombre="Directa (BA)", peso=D(60), hijos=[
                    _hoja("vend.v1", "0.5"), _hoja("vend.v2", "0.3"), _hoja("vend.v3", "0.2"),
                ]),
                Nodo(entidad="canal.distribuidores", nombre="Distribuidores", peso=D(40), hijos=[
                    _hoja("dist.d1", "3"), _hoja("dist.d2", "2"), _hoja("dist.d3", "1"),
                ]),
            ]),
        )

    movil = Movil(skus={"100": ingredientes, "200": soluciones("200"), "300": soluciones("300")})
    objetivos = {"100": ("1000", "50000.00"), "200": ("197718", "3934840140"), "300": ("777.777", "12345.67")}
    for codigo, (kilos, nns) in objetivos.items():
        raiz = movil.skus[codigo].raiz
        raiz.valores["kilos"].monto = D(kilos)
        raiz.valores["nns"].monto = D(nns)
    recalcular_todo(movil)
    return movil


def _monto(movil, sku, entidad, unidad="kilos"):
    return buscar(movil.skus[sku].raiz, entidad)[0].valores[unidad].monto


def _hojas(nodo):
    if not nodo.hijos:
        return [nodo]
    return [h for hijo in nodo.hijos for h in _hojas(hijo)]


def _todos(nodo):
    return [nodo] + [n for h in nodo.hijos for n in _todos(h)]


def _lanza_error_de_edicion(fn, *args):
    try:
        fn(*args)
        return False
    except ErrorDeEdicion:
        return True


# ---------------------------------------------------------------------------
# Cascada
# ---------------------------------------------------------------------------

def test_cascada_las_hojas_suman_exacto_el_total_original():
    """El test de la cascada: kilos y NNS, cada uno contra su propio total."""
    movil = _movil()
    raiz = movil.skus["200"].raiz

    for unidad, total in (("kilos", D("197718")), ("nns", D("3934840140"))):
        hojas = _hojas(raiz)
        assert len(hojas) == 6
        assert sum(h.valores[unidad].monto for h in hojas) == total
        assert all(n.cuadra[unidad] for n in _todos(raiz))


def test_cada_nivel_cuadra_contra_su_padre():
    movil = _movil()
    for nodo in _todos(movil.skus["200"].raiz):
        if nodo.hijos:
            partes = {h.entidad: h.valores["kilos"].monto for h in nodo.hijos}
            assert cuadra(nodo.valores["kilos"].monto, partes)


def test_profundidad_variable_por_segmento():
    """Ingredientes cierra en canal; Soluciones baja dos niveles."""
    movil = _movil()
    assert all(not h.hijos for h in movil.skus["100"].raiz.hijos)
    assert all(len(h.hijos) == 3 for h in movil.skus["200"].raiz.hijos)


def test_no_aplica_es_distinto_de_aplica_con_cero():
    movil = _movil()
    raiz = movil.skus["100"].raiz

    assert buscar(raiz, "canal.mayoristas") == (None, None)   # no aplica: no existe
    assert _monto(movil, "100", "canal.kam") == D("0.000")      # aplica con cero
    assert _monto(movil, "100", "canal.catering") == D("750.000")
    assert _monto(movil, "100", "canal.vending") == D("250.000")


def test_todo_arranca_calculado():
    movil = _movil()
    for nodo in _todos(movil.skus["200"].raiz)[1:]:
        assert nodo.valores["kilos"].estado == "calculado"


# ---------------------------------------------------------------------------
# Toggle ON/OFF
# ---------------------------------------------------------------------------

def test_deshabilitar_redistribuye_entre_los_que_quedan():
    movil = _movil()
    distribuidores = _monto(movil, "200", "canal.distribuidores")
    d1_antes = _monto(movil, "200", "dist.d1")

    cambiar_estado_entidad(movil, "dist.d3", False, "planner-local", CUANDO)

    assert _monto(movil, "200", "dist.d3") == D("0.000")
    assert _monto(movil, "200", "dist.d1") > d1_antes
    assert _monto(movil, "200", "dist.d1") + _monto(movil, "200", "dist.d2") == distribuidores
    assert movil.inactivas["dist.d3"].autor == "planner-local"


def test_deshabilitar_es_por_entidad_en_todos_los_skus():
    movil = _movil()
    cambiar_estado_entidad(movil, "dist.d3", False, "planner-local", CUANDO)

    assert _monto(movil, "200", "dist.d3") == 0
    assert _monto(movil, "300", "dist.d3") == 0


def test_rehabilitar_vuelve_al_reparto_original():
    movil = _movil()
    original = _monto(movil, "200", "dist.d1")

    cambiar_estado_entidad(movil, "dist.d3", False, "planner-local", CUANDO)
    cambiar_estado_entidad(movil, "dist.d3", True, "planner-local", CUANDO)

    assert _monto(movil, "200", "dist.d1") == original
    assert "dist.d3" not in movil.inactivas


def test_deshabilitar_un_intermedio_apaga_su_rama():
    """Sin Directa, Distribuidores absorbe todo y los vendedores quedan en cero."""
    movil = _movil()
    cambiar_estado_entidad(movil, "canal.directa", False, "planner-local", CUANDO)

    assert _monto(movil, "200", "canal.distribuidores") == D("197718.000")
    assert _monto(movil, "200", "vend.v1") == 0
    assert movil.skus["200"].raiz.cuadra["kilos"]


def test_deshabilitar_no_mueve_lo_fijado():
    movil = _movil()
    editar(movil, "200", "dist.d1", "kilos", D("100"), "planner-local", CUANDO)
    cambiar_estado_entidad(movil, "dist.d3", False, "planner-local", CUANDO)

    assert _monto(movil, "200", "dist.d1") == D("100")


# ---------------------------------------------------------------------------
# Edición con fijado
# ---------------------------------------------------------------------------

def test_editar_fija_el_valor_y_los_hermanos_absorben():
    movil = _movil()
    directa = _monto(movil, "200", "canal.directa")

    editar(movil, "200", "vend.v1", "kilos", D("1000.5"), "planner-local", CUANDO)

    v1 = buscar(movil.skus["200"].raiz, "vend.v1")[0].valores["kilos"]
    assert v1.monto == D("1000.5")
    assert v1.estado == "editado"
    assert (v1.traza.autor, v1.traza.cuando) == ("planner-local", CUANDO)
    assert _monto(movil, "200", "vend.v2") + _monto(movil, "200", "vend.v3") == directa - D("1000.5")


def test_editar_kilos_no_toca_nns():
    """Supuesto A2: cada unidad se edita y se fija por separado."""
    movil = _movil()
    nns_antes = _monto(movil, "200", "vend.v1", "nns")

    editar(movil, "200", "vend.v1", "kilos", D("1000"), "planner-local", CUANDO)

    assert _monto(movil, "200", "vend.v1", "nns") == nns_antes
    assert buscar(movil.skus["200"].raiz, "vend.v1")[0].valores["nns"].estado == "calculado"


def test_editar_un_intermedio_recalcula_su_rama_y_sus_hermanos():
    movil = _movil()
    editar(movil, "200", "canal.directa", "kilos", D("100000"), "planner-local", CUANDO)

    assert _monto(movil, "200", "canal.distribuidores") == D("97718.000")
    hojas_directa = buscar(movil.skus["200"].raiz, "canal.directa")[0].hijos
    assert sum(h.valores["kilos"].monto for h in hojas_directa) == D("100000")


def test_el_recalculo_no_pisa_lo_editado():
    """Editar A, después B: A no se mueve. Sin esto el planner entra en loop."""
    movil = _movil()
    editar(movil, "200", "vend.v1", "kilos", D("5000"), "planner-local", CUANDO)
    editar(movil, "200", "canal.directa", "kilos", D("100000"), "planner-local", CUANDO)

    assert _monto(movil, "200", "vend.v1") == D("5000")
    assert _monto(movil, "200", "vend.v2") + _monto(movil, "200", "vend.v3") == D("95000")


def test_desfijar_vuelve_a_calculado():
    movil = _movil()
    original = _monto(movil, "200", "vend.v1")
    editar(movil, "200", "vend.v1", "kilos", D("5000"), "planner-local", CUANDO)

    desfijar(movil, "200", "vend.v1", "kilos", "planner-local", CUANDO)

    v1 = buscar(movil.skus["200"].raiz, "vend.v1")[0].valores["kilos"]
    assert v1.estado == "calculado"
    assert v1.monto == original
    assert v1.traza.accion == "desfijado"


def test_ediciones_imposibles_se_rechazan():
    movil = _movil()
    padre = _monto(movil, "200", "canal.directa")

    assert _lanza_error_de_edicion(editar, movil, "200", "vend.v1", "kilos", D("-1"), "p", CUANDO)
    assert _lanza_error_de_edicion(editar, movil, "200", "vend.v1", "kilos", padre + 1, "p", CUANDO)
    assert _lanza_error_de_edicion(editar, movil, "200", "vend.v1", "kilos", D("1.0001"), "p", CUANDO)
    assert _lanza_error_de_edicion(editar, movil, "200", "vend.v1", "litros", D("1"), "p", CUANDO)
    assert _lanza_error_de_edicion(editar, movil, "200", "sku.200", "kilos", D("1"), "p", CUANDO)
    assert _lanza_error_de_edicion(editar, movil, "200", "no.existe", "kilos", D("1"), "p", CUANDO)
    assert _lanza_error_de_edicion(editar, movil, "999", "vend.v1", "kilos", D("1"), "p", CUANDO)
    assert _lanza_error_de_edicion(editar, movil, "200", "vend.v1", "kilos", 1.5, "p", CUANDO)
    # nada quedó fijado por los intentos fallidos
    assert buscar(movil.skus["200"].raiz, "vend.v1")[0].valores["kilos"].estado == "calculado"


def test_no_se_edita_una_entidad_deshabilitada():
    movil = _movil()
    cambiar_estado_entidad(movil, "dist.d3", False, "p", CUANDO)
    assert _lanza_error_de_edicion(editar, movil, "200", "dist.d3", "kilos", D("1"), "p", CUANDO)


def test_todos_fijados_que_no_cierran_se_permite_y_marca_no_cuadra():
    """
    El planner edita en secuencia y necesita estados intermedios. Nunca se ajusta
    por atrás: los tres valores quedan como los puso.
    """
    movil = _movil()
    for entidad in ("dist.d1", "dist.d2", "dist.d3"):
        editar(movil, "200", entidad, "kilos", D("10"), "p", CUANDO)

    distribuidores = buscar(movil.skus["200"].raiz, "canal.distribuidores")[0]
    assert [h.valores["kilos"].monto for h in distribuidores.hijos] == [D("10")] * 3
    assert distribuidores.cuadra["kilos"] is False
    assert distribuidores.cuadra["nns"] is True


def test_fijados_que_superan_al_padre_dejan_los_calculados_en_cero_con_aviso():
    movil = _movil()
    padre = _monto(movil, "200", "canal.distribuidores")
    editar(movil, "200", "dist.d1", "kilos", padre, "p", CUANDO)
    editar(movil, "200", "dist.d2", "kilos", D("1"), "p", CUANDO)

    distribuidores = buscar(movil.skus["200"].raiz, "canal.distribuidores")[0]
    assert _monto(movil, "200", "dist.d3") == 0
    assert distribuidores.cuadra["kilos"] is False
    assert distribuidores.aviso["kilos"]


# ---------------------------------------------------------------------------
# Problemas de datos en el árbol
# ---------------------------------------------------------------------------

def test_error_de_datos_bloquea_el_reparto_automatico_pero_no_la_edicion():
    movil = _movil()
    nodo = buscar(movil.skus["200"].raiz, "canal.directa")[0]
    nodo.error = "Las participaciones de vendedores suman 97%, no 100%."
    recalcular_todo(movil)

    assert all(h.valores["kilos"].monto == 0 for h in nodo.hijos)
    assert nodo.cuadra["kilos"] is False

    # el planner puede resolverlo a mano
    total = nodo.valores["kilos"].monto
    editar(movil, "200", "vend.v1", "kilos", total - 2, "p", CUANDO)
    editar(movil, "200", "vend.v2", "kilos", D("1"), "p", CUANDO)
    editar(movil, "200", "vend.v3", "kilos", D("1"), "p", CUANDO)
    assert nodo.cuadra["kilos"] is True


def test_hoja_con_error_no_cuadra_hasta_quedar_en_cero():
    """Directa con volumen y sin vendedores: ese volumen no llega a nadie."""
    movil = _movil()
    cc = buscar(movil.skus["200"].raiz, "canal.directa")[0]
    cc.hijos = []
    cc.error = "Directa sin reparto previo de vendedores."
    recalcular_todo(movil)
    assert cc.cuadra["kilos"] is False
    assert cc.aviso["kilos"] == cc.error

    # el planner lo resuelve mandando todo a Distribuidores
    editar(movil, "200", "canal.directa", "kilos", D("0"), "p", CUANDO)
    assert cc.cuadra["kilos"] is True
    assert _monto(movil, "200", "canal.distribuidores") == D("197718.000")


def test_peso_negativo_no_se_reparte_y_deshabilitarlo_lo_resuelve():
    movil = _movil()
    buscar(movil.skus["200"].raiz, "dist.d3")[0].peso = D("-5")
    recalcular_todo(movil)
    distribuidores = buscar(movil.skus["200"].raiz, "canal.distribuidores")[0]

    assert distribuidores.cuadra["kilos"] is False
    assert "negativ" in distribuidores.aviso["kilos"].lower()

    cambiar_estado_entidad(movil, "dist.d3", False, "p", CUANDO)
    assert distribuidores.cuadra["kilos"] is True
    assert distribuidores.aviso["kilos"] is None


# ---------------------------------------------------------------------------
# Vista agregada
# ---------------------------------------------------------------------------

def test_agregado_suma_cada_entidad_sobre_todos_los_skus():
    movil = _movil()
    total = agregado(movil)

    assert total.valores["kilos"].monto == D("1000") + D("197718") + D("777.777")
    cc = buscar(total, "canal.directa")[0]
    assert cc.valores["kilos"].monto == _monto(movil, "200", "canal.directa") + _monto(movil, "300", "canal.directa")
    assert all(n.cuadra["kilos"] and n.cuadra["nns"] for n in _todos(total))


def test_agregado_es_una_copia_de_solo_lectura():
    movil = _movil()
    total = agregado(movil)
    buscar(total, "vend.v1")[0].valores["kilos"].monto = D("0")

    assert _monto(movil, "200", "vend.v1") != 0
