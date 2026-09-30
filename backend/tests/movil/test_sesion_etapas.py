"""
Revisión por etapa (MUST): el planner da el OK a cada etapa antes de aprobar. Etapa 1:
el reparto por canal. Etapa 2: cómo se abre debajo del canal. Un cambio en una etapa
borra el OK de esa y de las siguientes, porque las recalcula.

SUPUESTO (B3, a confirmar): aprobar exige las etapas revisadas.
"""

from datetime import datetime

from tests.movil.test_sesion import CUANDO, NUEVO, P, _falla, _sesion

DESPUES = datetime(2026, 9, 24, 11, 0)


def _cerrado():
    s = _sesion("input2_sin_sku_nuevo.tsv")
    s.cambiar_sku(NUEVO, activo=False, autor=P, cuando=CUANDO, motivo="nuevo")
    return s


def _revisado(s):
    s.revisar_etapa("canal", P, DESPUES)
    s.revisar_etapa("apertura", P, DESPUES)
    return s


def test_se_revisan_en_orden_y_quedan_en_el_historial():
    s = _cerrado()
    assert _falla(s.revisar_etapa, "apertura", P, DESPUES)  # primero la etapa por canal
    s.revisar_etapa("canal", P, DESPUES)
    s.revisar_etapa("apertura", P, DESPUES)
    assert set(s.revisadas) == {"canal", "apertura"}
    assert [a.accion for a in s.historial][-2:] == ["revisar_etapa", "revisar_etapa"]


def test_no_se_revisa_la_etapa_por_canal_si_no_cierra():
    assert _falla(_sesion().revisar_etapa, "canal", P, DESPUES)


def test_aprobar_exige_las_etapas_revisadas():
    s = _cerrado()
    assert _falla(s.aprobar, P, DESPUES)
    s.revisar_etapa("canal", P, DESPUES)
    assert _falla(s.aprobar, P, DESPUES)
    s.revisar_etapa("apertura", P, DESPUES)
    s.aprobar(P, DESPUES)


def test_un_cambio_en_la_etapa_por_canal_borra_las_dos():
    s = _revisado(_cerrado())
    s.cambiar_sku(NUEVO, activo=True, autor=P, cuando=DESPUES, motivo="m")
    assert s.revisadas == {}


def test_un_cambio_debajo_del_canal_borra_solo_esa():
    s = _revisado(_cerrado())
    s.cambiar_entidad("Nicolás Paz", activo=False, autor=P, cuando=DESPUES, motivo="se fue")
    assert set(s.revisadas) == {"canal"}


def test_deshacer_tambien_borra_lo_que_recalcula():
    s = _cerrado()
    s.cambiar_entidad("Nicolás Paz", activo=False, autor=P, cuando=DESPUES, motivo="se fue")
    _revisado(s)
    s.deshacer(P, DESPUES)
    assert set(s.revisadas) == {"canal"}


def test_revisar_dos_veces_no_duplica_el_historial():
    s = _cerrado()
    s.revisar_etapa("canal", P, DESPUES)
    assert _falla(s.revisar_etapa, "canal", P, DESPUES)
    assert [a.accion for a in s.historial].count("revisar_etapa") == 1


def test_volver_a_cargar_un_archivo_borra_las_dos():
    from tests.movil.test_sesion import MUESTRA
    s = _revisado(_cerrado())
    s.cargar_input2((MUESTRA / "input2_sin_sku_nuevo.tsv").read_text(encoding="utf-8"), P, DESPUES)
    assert s.revisadas == {}


def test_una_etapa_que_no_existe_se_rechaza():
    assert _falla(_cerrado().revisar_etapa, "vendedor", P, DESPUES)
