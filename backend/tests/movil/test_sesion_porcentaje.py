"""
Base de cálculo en la sesión: el planner le pone a una entidad un % manual en un canal
(vale para todos los SKUs de ese canal) o la vuelve a histórico. Con motivo, al historial.
"""

from datetime import datetime
from decimal import Decimal as D

from tests.movil.test_sesion import CUANDO, NUEVO, P, _falla, _sesion

DESPUES = datetime(2026, 9, 24, 11, 0)
CANAL, VENDEDOR = "Córdoba", "Nicolás Paz"


def _cerrado():
    s = _sesion("input2_sin_sku_nuevo.tsv")
    s.cambiar_sku(NUEVO, activo=False, autor=P, cuando=CUANDO, motivo="nuevo")
    return s


def _suyo(s, unidad="kilos"):
    """
    (valor de la celda, lo que recibe el vendedor, si hay otros con historia) en cada celda
    de Córdoba que se abre. Si no estaba en la celda, recibe 0.
    """
    filas = []
    for (_, canal), raiz in s.recorrido.aperturas.items():
        if canal != CANAL:
            continue
        suyo = next((h.valores[unidad].monto for h in raiz.hijos if h.entidad == VENDEDOR), D(0))
        otros = any(h.peso > 0 for h in raiz.hijos if h.entidad != VENDEDOR)
        filas.append((raiz.valores[unidad].monto, suyo, otros))
    return filas


def test_con_porcentaje_recibe_ese_porcentaje_de_cada_celda_del_canal():
    s = _cerrado()
    s.asignar_porcentaje(CANAL, VENDEDOR, "30", P, DESPUES, "le cambiaron la cartera")
    celdas = _suyo(s)
    assert any(otros for _, _, otros in celdas)
    for total, suyo, otros in celdas:
        # Si nadie más tiene historia en la celda, no hay a quién darle el resto: se lleva todo.
        esperado = total * D("0.3") if otros else total
        assert abs(suyo - esperado) <= D("0.001"), (total, suyo)
    assert all(r.cuadra["kilos"] and r.cuadra["nns"] for r in s.recorrido.aperturas.values()
               if r.nombre == CANAL)
    assert s.historial[-1].accion == "porcentaje" and s.historial[-1].motivo == "le cambiaron la cartera"


def test_volver_a_historico_deja_todo_como_antes():
    s = _cerrado()
    antes = _suyo(s)
    s.asignar_porcentaje(CANAL, VENDEDOR, "30", P, DESPUES, "m")
    s.asignar_porcentaje(CANAL, VENDEDOR, None, P, DESPUES, "vuelve a lo de siempre")
    assert _suyo(s) == antes and s.porcentajes == {}


def test_se_rechaza_lo_que_no_es_valido():
    s = _cerrado()
    assert _falla(s.asignar_porcentaje, CANAL, "Nadie", "30", P, DESPUES, "m")          # no está en el canal
    assert _falla(s.asignar_porcentaje, "Distribuidores", VENDEDOR, "30", P, DESPUES, "m")  # es de otro canal
    assert _falla(s.asignar_porcentaje, CANAL, VENDEDOR, "treinta", P, DESPUES, "m")
    assert _falla(s.asignar_porcentaje, CANAL, VENDEDOR, "0", P, DESPUES, "m")
    assert _falla(s.asignar_porcentaje, CANAL, VENDEDOR, "30", P, DESPUES, "")          # sin motivo


def test_los_porcentajes_de_un_canal_no_pasan_de_cien():
    s = _cerrado()
    s.asignar_porcentaje(CANAL, VENDEDOR, "70", P, DESPUES, "m")
    assert _falla(s.asignar_porcentaje, CANAL, "Sofía Correa", "40", P, DESPUES, "m")
    s.asignar_porcentaje(CANAL, "Sofía Correa", "30", P, DESPUES, "m")
    s.asignar_porcentaje(CANAL, VENDEDOR, "60", P, DESPUES, "cambiar el propio no suma dos veces")


def test_se_deshace_como_cualquier_ajuste():
    s = _cerrado()
    s.asignar_porcentaje(CANAL, VENDEDOR, "30", P, DESPUES, "m")
    s.deshacer(P, DESPUES)
    assert s.porcentajes == {}


def test_el_canal_se_guarda_con_el_nombre_de_los_totales():
    s = _cerrado()
    s.asignar_porcentaje("cordoba", VENDEDOR, "30", P, DESPUES, "m")
    assert list(s.porcentajes) == [(CANAL, VENDEDOR)]
    assert _falla(s.asignar_porcentaje, "Tucumán", VENDEDOR, "30", P, DESPUES, "m")


def test_volver_a_historico_si_ya_va_por_historico_no_ensucia_el_historial():
    s = _cerrado()
    assert _falla(s.asignar_porcentaje, CANAL, VENDEDOR, None, P, DESPUES, "m")


def test_un_porcentaje_que_queda_sin_canal_se_avisa_y_no_se_aplica():
    from tests.movil.test_sesion import MUESTRA
    s = _cerrado()
    s.asignar_porcentaje(CANAL, VENDEDOR, "30", P, DESPUES, "m")
    texto = (MUESTRA / "input2_sin_sku_nuevo.tsv").read_text(encoding="utf-8").replace("Córdoba", "Córdoba Centro")
    s.cargar_input2(texto, P, DESPUES)
    assert any("30% de Nicolás Paz en Córdoba no se aplica" in p.mensaje for p in s.recorrido.problemas)
