"""
Alta de vendedor o distribuidor nuevo (MUST): se suma a un canal con un % manual. No
tiene historia, así que sin % no recibiría nada.

SUPUESTO (B2, a confirmar): se da de alta en la herramienta, no hace falta que venga en
el archivo.
"""

from datetime import datetime
from decimal import Decimal as D

from tests.movil.test_sesion import CUANDO, NUEVO, P, _falla, _sesion

DESPUES = datetime(2026, 9, 24, 11, 0)
CANAL, NUEVA = "Córdoba", "Vendedora Nueva"


def _cerrado():
    s = _sesion("input2_sin_sku_nuevo.tsv")
    s.cambiar_sku(NUEVO, activo=False, autor=P, cuando=CUANDO, motivo="nuevo")
    return s


def _suyo(s, entidad=NUEVA):
    return [next((h.valores["kilos"].monto for h in raiz.hijos if h.entidad == entidad), None)
            for (_, canal), raiz in s.recorrido.aperturas.items() if canal == CANAL]


def test_una_entidad_nueva_recibe_su_porcentaje_en_cada_celda_del_canal():
    s = _cerrado()
    s.agregar_entidad(CANAL, NUEVA, "20", P, DESPUES, "entró en octubre")
    montos = _suyo(s)
    assert montos and all(m is not None and m > 0 for m in montos)
    assert all(r.cuadra["kilos"] and r.cuadra["nns"] for (_, c), r in s.recorrido.aperturas.items() if c == CANAL)
    assert s.historial[-1].accion == "agregar_entidad" and s.historial[-1].motivo == "entró en octubre"
    assert (CANAL, NUEVA) in s.entidades_nuevas and s.porcentajes[(CANAL, NUEVA)][0] == D("20")


def test_se_puede_apagar_y_cambiar_su_porcentaje_como_a_cualquiera():
    s = _cerrado()
    s.agregar_entidad(CANAL, NUEVA, "20", P, DESPUES, "m")
    s.asignar_porcentaje(CANAL, NUEVA, "10", P, DESPUES, "arranca de a poco")
    s.cambiar_entidad(NUEVA, activo=False, autor=P, cuando=DESPUES, motivo="se fue")
    assert all(m == 0 for m in _suyo(s))


def test_sin_porcentaje_no_se_puede_porque_no_tiene_historia():
    s = _cerrado()
    assert _falla(s.agregar_entidad, CANAL, NUEVA, None, P, DESPUES, "m")
    s.agregar_entidad(CANAL, NUEVA, "20", P, DESPUES, "m")
    assert _falla(s.asignar_porcentaje, CANAL, NUEVA, None, P, DESPUES, "volver a histórico")


def test_se_rechaza_lo_que_no_es_valido():
    s = _cerrado()
    assert _falla(s.agregar_entidad, CANAL, "Nicolás Paz", "20", P, DESPUES, "m")   # ya está en el canal
    assert _falla(s.agregar_entidad, "Catering", NUEVA, "20", P, DESPUES, "m")      # Catering no se abre
    assert _falla(s.agregar_entidad, CANAL, "  ", "20", P, DESPUES, "m")
    assert _falla(s.agregar_entidad, CANAL, NUEVA, "20", P, DESPUES, "")            # sin motivo
    s.asignar_porcentaje(CANAL, "Nicolás Paz", "90", P, DESPUES, "m")
    assert _falla(s.agregar_entidad, CANAL, NUEVA, "20", P, DESPUES, "m")           # pasaría de 100


def test_eliminarla_la_saca_de_todo():
    s = _cerrado()
    antes = _suyo(s, "Nicolás Paz")
    s.agregar_entidad(CANAL, NUEVA, "20", P, DESPUES, "m")
    s.eliminar_entidad(CANAL, NUEVA, P, DESPUES, "la cargué por error")
    assert _suyo(s, "Nicolás Paz") == antes and set(_suyo(s)) == {None}
    assert s.entidades_nuevas == {} and s.porcentajes == {}
    assert _falla(s.eliminar_entidad, CANAL, "Nicolás Paz", P, DESPUES, "m")  # solo las nuevas


def test_se_deshace_como_cualquier_ajuste():
    s = _cerrado()
    s.agregar_entidad(CANAL, NUEVA, "20", P, DESPUES, "m")
    s.deshacer(P, DESPUES)
    assert s.entidades_nuevas == {} and s.porcentajes == {}


def test_no_se_da_de_alta_un_nombre_que_ya_existe_en_otro_canal():
    """El ON/OFF es por nombre: dos con el mismo nombre se apagarían y prenderían juntos."""
    s = _cerrado()
    assert _falla(s.agregar_entidad, CANAL, "Federico Luna", "20", P, DESPUES, "m")  # está en Rosario
    assert _falla(s.agregar_entidad, CANAL, "nicolas paz", "20", P, DESPUES, "m")    # mismo nombre, otra grafía


def test_el_canal_se_guarda_con_el_nombre_de_los_totales():
    s = _cerrado()
    s.agregar_entidad("cordoba", NUEVA, "20", P, DESPUES, "m")
    assert list(s.entidades_nuevas) == [(CANAL, NUEVA)]
    assert all(m is not None and m > 0 for m in _suyo(s))
    s.eliminar_entidad("CORDOBA", NUEVA, P, DESPUES, "m")
    assert s.entidades_nuevas == {}


def test_una_nueva_no_queda_como_porcentaje_huerfano():
    s = _cerrado()
    s.agregar_entidad(CANAL, NUEVA, "20", P, DESPUES, "m")
    assert not any("no se aplica" in p.mensaje for p in s.recorrido.problemas)


def test_deshacer_eliminar_la_devuelve_con_su_porcentaje():
    s = _cerrado()
    s.agregar_entidad(CANAL, NUEVA, "20", P, DESPUES, "m")
    s.eliminar_entidad(CANAL, NUEVA, P, DESPUES, "m")
    s.deshacer(P, DESPUES)
    assert (CANAL, NUEVA) in s.entidades_nuevas and s.porcentajes[(CANAL, NUEVA)][0] == D("20")
