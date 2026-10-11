"""
Reconstruir un mes desde lo guardado vuelve a ejecutar cada acción. Para no recalcular
el reparto entero en cada una, la sesión puede diferir el recálculo: se hace una vez,
cuando alguien pide el resultado. El resultado tiene que ser idéntico.
"""

from datetime import datetime

from src.movil.sesion import Sesion
from tests.movil.test_sesion import CUANDO, MUESTRA, NUEVO, P

DESPUES = datetime(2026, 9, 24, 11, 0)


def _jugar(s):
    s.cargar_input1(MUESTRA / "input1_objetivo.xlsx", "a", P, CUANDO)
    s.cargar_input2((MUESTRA / "input2_sin_sku_nuevo.tsv").read_text(encoding="utf-8"), P, CUANDO)
    s.cargar_base(MUESTRA / "base_mes_anterior.xlsx", "b", P, CUANDO)
    s.cambiar_sku(NUEVO, activo=False, autor=P, cuando=CUANDO, motivo="nuevo")
    s.cambiar_entidad("Nicolás Paz", activo=False, autor=P, cuando=DESPUES, motivo="se fue")
    s.asignar_porcentaje("Córdoba", "Sofía Correa", "30", P, DESPUES, "cartera nueva")
    s.revisar_etapa("canal", P, DESPUES)  # necesita el resultado: lo calcula en el momento
    s.cambiar_entidad("Nicolás Paz", activo=True, autor=P, cuando=DESPUES, motivo="volvió")
    s.deshacer(P, DESPUES)
    return s


def _foto(s):
    r = s.recorrido
    return (r.kilos.celdas, r.plata.celdas,
            {k: [(h.entidad, h.valores["kilos"].monto, h.valores["nns"].monto) for h in raiz.hijos]
             for k, raiz in r.aperturas.items()})


def test_diferir_el_recalculo_da_el_mismo_resultado():
    normal = _jugar(Sesion())
    diferida = Sesion()
    diferida.diferir = True
    _jugar(diferida)
    diferida.diferir = False
    assert _foto(diferida) == _foto(normal)
    assert [a.accion for a in diferida.historial] == [a.accion for a in normal.historial]
    assert diferida.revisadas.keys() == normal.revisadas.keys()
