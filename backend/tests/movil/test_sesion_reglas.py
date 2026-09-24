"""
Reglas en la sesión: el planner las agrega, edita y elimina, cada cambio con
motivo y en el historial. Una regla válida que no se puede cumplir se guarda y
queda marcada (el planner trabaja en pasos); una regla mal cargada se rechaza.
"""

from datetime import datetime
from decimal import Decimal as D
from pathlib import Path

from src.movil.sesion import ErrorDeAjuste, Sesion

MUESTRA = Path(__file__).parents[3] / "data" / "sample"
NUEVO = "90020900"
CUANDO = datetime(2026, 9, 24, 10, 0)
P = "planner-local"


def _sesion() -> Sesion:
    s = Sesion()
    s.cargar_input1(MUESTRA / "input1_objetivo.xlsx", "input1_objetivo.xlsx", P, CUANDO)
    s.cargar_input2((MUESTRA / "input2_sin_sku_nuevo.tsv").read_text(encoding="utf-8"), P, CUANDO)
    s.cargar_base(MUESTRA / "base_mes_anterior.xlsx", "base_mes_anterior.xlsx", P, CUANDO)
    s.cambiar_sku(NUEVO, activo=False, autor=P, cuando=CUANDO, motivo="nuevo")
    return s


def _agregar(s, **cambios):
    datos = dict(canal="Catering", categorias=["Café"], limite="tope", kilos="20", nns="25",
                 autor=P, cuando=CUANDO, motivo="acuerdo con la cadena")
    datos.update(cambios)
    return s.agregar_regla(**datos)


def _falla(fn, *args, **kwargs):
    try:
        fn(*args, **kwargs)
        return False
    except ErrorDeAjuste:
        return True


def test_agregar_una_regla_la_aplica_y_queda_en_el_historial():
    s = _sesion()
    antes = dict(s.recorrido.kilos.celdas)
    id_ = _agregar(s)
    assert id_ == "R1"
    regla = s.reglas[id_].regla
    assert regla.kilos == D("20") and regla.nns == D("25") and regla.categorias == frozenset({"Café"})
    assert s.recorrido.kilos.celdas != antes
    assert s.historial[-1].accion == "agregar_regla" and s.historial[-1].motivo == "acuerdo con la cadena"
    assert "R1" in s.historial[-1].detalle and "Catering" in s.historial[-1].detalle


def test_los_porcentajes_se_escriben_como_en_excel():
    s = _sesion()
    id_ = _agregar(s, kilos="12,5", nns="7.25")
    assert s.reglas[id_].regla.kilos == D("12.5") and s.reglas[id_].regla.nns == D("7.25")


def test_una_regla_solo_de_kilos():
    s = _sesion()
    id_ = _agregar(s, nns=None)
    assert s.reglas[id_].regla.nns is None
    id2 = _agregar(s, kilos="", nns="30")  # vacío = no aplica en esa unidad
    assert s.reglas[id2].regla.kilos is None


def test_una_regla_mal_cargada_se_rechaza_y_no_deja_nada():
    s = _sesion()
    casos = [
        dict(motivo=" "),  # sin motivo
        dict(kilos=None, nns=None),  # sin ningún %
        dict(kilos="", nns=""),
        dict(kilos="120"),  # más de 100%
        dict(kilos="-1"),
        dict(kilos="mucho"),
        dict(limite="techo"),
        dict(categorias=[]),
        dict(categorias=["  "]),
        dict(canal=""),
    ]
    for caso in casos:
        assert _falla(_agregar, s, **caso), caso
    assert s.reglas == {}
    assert s.historial[-1].accion == "apagar_sku"


def test_una_regla_que_no_se_puede_cumplir_se_guarda_y_queda_marcada():
    s = _sesion()
    _agregar(s, limite="tope", kilos="10", nns=None)
    _agregar(s, limite="minimo", kilos="15", nns=None)
    assert set(s.reglas) == {"R1", "R2"}
    assert [i.reglas for i in s.recorrido.kilos.inconsistencias] == [("R1", "R2")]


def test_editar_una_regla_mantiene_su_id_y_registra_el_cambio():
    s = _sesion()
    id_ = _agregar(s)
    s.editar_regla(id_, canal="Catering", categorias=["Café", "Chocolatería"], limite="tope", kilos="45",
                   nns=None, autor=P, cuando=CUANDO, motivo="se sumó chocolatería")
    regla = s.reglas[id_].regla
    assert regla.categorias == frozenset({"Café", "Chocolatería"}) and regla.nns is None
    assert s.historial[-1].accion == "editar_regla" and s.historial[-1].motivo == "se sumó chocolatería"
    assert _falla(s.editar_regla, "R9", canal="Catering", categorias=["Café"], limite="tope", kilos="1",
                  nns=None, autor=P, cuando=CUANDO, motivo="x")


def test_eliminar_una_regla_vuelve_al_reparto_sin_ella_y_el_id_no_se_reusa():
    s = _sesion()
    sin = dict(s.recorrido.kilos.celdas)
    id_ = _agregar(s)
    assert _falla(s.eliminar_regla, id_, autor=P, cuando=CUANDO, motivo="")
    s.eliminar_regla(id_, autor=P, cuando=CUANDO, motivo="se cayó el acuerdo")
    assert s.reglas == {}
    assert s.recorrido.kilos.celdas == sin
    assert s.historial[-1].accion == "eliminar_regla"
    assert _agregar(s) == "R2"  # el historial sigue hablando de R1: no se reusa


def test_las_reglas_se_cargan_antes_de_tener_las_entradas():
    """Los lineamientos se cargan antes de repartir: una regla no necesita el input 1."""
    s = Sesion()
    id_ = _agregar(s)
    assert id_ == "R1" and s.recorrido is None
