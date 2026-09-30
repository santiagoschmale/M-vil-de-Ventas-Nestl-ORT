"""
Aprobar el móvil (MUST): solo si kilos y pesos cierran. Aprobado es solo lectura hasta
que alguien lo reabre con motivo. Las dos cosas quedan en el historial.
"""

from datetime import datetime

from tests.movil.test_sesion import CUANDO, MUESTRA, NUEVO, P, _falla, _sesion

DESPUES = datetime(2026, 9, 24, 11, 0)


def _cerrado():
    """Cierra y tiene las dos etapas revisadas: listo para aprobar."""
    s = _sesion("input2_sin_sku_nuevo.tsv")
    s.cambiar_sku(NUEVO, activo=False, autor=P, cuando=CUANDO, motivo="nuevo")
    s.revisar_etapa("canal", P, CUANDO)
    s.revisar_etapa("apertura", P, CUANDO)
    return s


def test_se_aprueba_un_movil_que_cierra_y_queda_en_el_historial():
    s = _cerrado()
    s.aprobar(P, DESPUES)
    assert s.aprobado.autor == P and s.aprobado.cuando == DESPUES
    assert s.historial[-1].accion == "aprobar"


def test_no_se_aprueba_si_no_cierra():
    s = _sesion()  # el SKU nuevo sin historia frena el reparto
    assert _falla(s.aprobar, P, DESPUES)
    assert s.aprobado is None


def test_no_se_aprueba_sin_las_tres_entradas():
    from src.movil.sesion import Sesion
    assert _falla(Sesion().aprobar, P, DESPUES)


def test_aprobado_no_se_puede_tocar():
    s = _cerrado()
    s.aprobar(P, DESPUES)
    antes = s.recorrido
    assert _falla(s.cambiar_sku, NUEVO, activo=True, autor=P, cuando=DESPUES, motivo="m")
    assert _falla(s.cargar_input2, (MUESTRA / "input2_canales.tsv").read_text(encoding="utf-8"), P, DESPUES)
    assert _falla(s.deshacer, P, DESPUES)
    assert _falla(s.aprobar, P, DESPUES)
    assert s.recorrido is antes and NUEVO in s.apagados_skus


def test_reabrir_pide_motivo_y_vuelve_a_borrador():
    s = _cerrado()
    s.aprobar(P, DESPUES)
    assert _falla(s.reabrir, P, DESPUES, "")
    s.reabrir(P, DESPUES, "faltó un acuerdo con un distribuidor")
    assert s.aprobado is None
    assert s.historial[-1].accion == "reabrir" and s.historial[-1].motivo == "faltó un acuerdo con un distribuidor"
    s.cambiar_sku(NUEVO, activo=True, autor=P, cuando=DESPUES, motivo="se vuelve a repartir")


def test_reabrir_un_borrador_no_tiene_sentido():
    assert _falla(_cerrado().reabrir, P, DESPUES, "m")


def test_aprobar_o_reabrir_no_se_deshace():
    """Deshacer es para ajustes: aprobar y reabrir son decisiones que quedan."""
    s = _cerrado()
    s.aprobar(P, DESPUES)
    s.reabrir(P, DESPUES, "m")
    assert s.ultimo_cambio is None


def test_despues_de_reabrir_deshacer_no_revierte_lo_de_antes_de_aprobar():
    s = _cerrado()  # el último ajuste es apagar el SKU nuevo
    s.aprobar(P, DESPUES)
    s.reabrir(P, DESPUES, "m")
    assert _falla(s.deshacer, P, DESPUES)
    assert NUEVO in s.apagados_skus
