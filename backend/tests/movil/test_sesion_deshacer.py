"""
Deshacer: vuelve atrás el último cambio, una sola vez. Queda en el historial como un
ajuste más (no borra lo que se hizo) y después se deshabilita hasta el próximo cambio.
"""

from datetime import datetime

from src.movil.sesion import ErrorDeAjuste, Sesion
from tests.movil.test_sesion import CUANDO, MUESTRA, NUEVO, P, _falla, _sesion

DESPUES = datetime(2026, 9, 24, 11, 0)


def test_sin_cambios_no_hay_nada_para_deshacer():
    s = Sesion()
    assert s.ultimo_cambio is None
    assert _falla(s.deshacer, P, CUANDO)


def test_deshace_el_ultimo_ajuste_y_deja_el_reparto_como_estaba():
    s = _sesion()
    antes = s.recorrido
    s.cambiar_sku(NUEVO, activo=False, autor=P, cuando=CUANDO, motivo="nuevo")
    assert s.ultimo_cambio.accion == "apagar_sku"

    s.deshacer(P, DESPUES)
    assert NUEVO not in s.apagados_skus
    assert s.recorrido is antes


def test_queda_en_el_historial_y_no_borra_lo_que_se_hizo():
    s = _sesion()
    s.cambiar_sku(NUEVO, activo=False, autor=P, cuando=CUANDO, motivo="nuevo")
    s.deshacer(P, DESPUES)
    assert [a.accion for a in s.historial][-2:] == ["apagar_sku", "deshacer"]
    assert s.historial[-1].detalle == f"Deshizo: {s.historial[-2].detalle}"
    assert s.historial[-1].cuando == DESPUES


def test_es_una_sola_vez():
    s = _sesion()
    s.cambiar_sku(NUEVO, activo=False, autor=P, cuando=CUANDO, motivo="nuevo")
    s.deshacer(P, DESPUES)
    assert s.ultimo_cambio is None
    assert _falla(s.deshacer, P, DESPUES)


def test_un_cambio_rechazado_no_cuenta_como_ultimo():
    s = _sesion()
    s.cambiar_sku(NUEVO, activo=False, autor=P, cuando=CUANDO, motivo="nuevo")
    assert _falla(s.fijar, "kilos", "no-existe", "Córdoba", "1", P, CUANDO, "x")
    assert s.ultimo_cambio.accion == "apagar_sku"


def test_deshace_tambien_una_carga_de_archivo():
    s = _sesion()
    antes = s.entradas.canales
    s.cargar_input2((MUESTRA / "input2_sin_sku_nuevo.tsv").read_text(encoding="utf-8"), P, CUANDO)
    s.deshacer(P, DESPUES)
    assert s.entradas.canales is antes


def test_deshacer_una_regla_no_reusa_su_id():
    """El historial nombra a R1: la próxima regla tiene que ser R2 aunque R1 se deshizo."""
    s = _sesion()
    datos = dict(canal="Córdoba", categorias=["Café"], limite="tope", kilos="50", nns=None)
    assert s.agregar_regla(**datos, autor=P, cuando=CUANDO, motivo="m") == "R1"
    s.deshacer(P, DESPUES)
    assert s.reglas == {}
    assert s.agregar_regla(**datos, autor=P, cuando=CUANDO, motivo="m") == "R2"
