"""
Profundidad configurable por canal (pedido del cliente, 07/10): un canal que se abre en
el archivo se puede cerrar en la herramienta, y vuelve a abrirse. Se hereda.
"""

from datetime import datetime

from tests.movil.test_sesion import CUANDO, NUEVO, P, _falla, _sesion

DESPUES = datetime(2026, 10, 2, 11, 0)


def _cerrado():
    s = _sesion("input2_sin_sku_nuevo.tsv")
    s.cambiar_sku(NUEVO, activo=False, autor=P, cuando=CUANDO, motivo="nuevo")
    return s


def test_cerrar_un_canal_lo_deja_sin_apertura_y_se_vuelve_a_abrir():
    s = _cerrado()
    assert any(c == "Córdoba" for _, c in s.recorrido.aperturas)
    s.cambiar_apertura_canal("Córdoba", False, P, DESPUES, "no se abre más por vendedor")
    assert not any(c == "Córdoba" for _, c in s.recorrido.aperturas)
    assert any(c == "Rosario" for _, c in s.recorrido.aperturas)  # los demás, igual
    assert s.canales_que_se_abren() == {"Córdoba": False, "Directa (BA)": True, "Distribuidores": True, "Rosario": True}
    s.cambiar_apertura_canal("cordoba", True, P, DESPUES, "vuelve")
    assert any(c == "Córdoba" for _, c in s.recorrido.aperturas)


def test_cerrar_un_canal_borra_el_ok_de_la_apertura():
    s = _cerrado()
    s.revisar_etapa("canal", P, DESPUES)
    s.revisar_etapa("apertura", P, DESPUES)
    s.cambiar_apertura_canal("Córdoba", False, P, DESPUES, "m")
    assert set(s.revisadas) == {"canal"}


def test_se_rechaza_lo_que_no_es_valido():
    s = _cerrado()
    assert _falla(s.cambiar_apertura_canal, "Catering", False, P, DESPUES, "m")  # no se abre en el archivo
    assert _falla(s.cambiar_apertura_canal, "Córdoba", True, P, DESPUES, "m")    # ya se abre
    assert _falla(s.cambiar_apertura_canal, "Córdoba", False, P, DESPUES, "")    # sin motivo
