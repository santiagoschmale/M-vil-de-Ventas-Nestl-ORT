"""
La sesión del planner: carga las entradas, recalcula con cada ajuste y registra
qué cambió, quién, cuándo y por qué.
"""

from datetime import datetime
from decimal import Decimal as D
from pathlib import Path

from src.movil.sesion import ErrorDeAjuste, Sesion

MUESTRA = Path(__file__).parents[3] / "data" / "sample"
NUEVO = "90020900"
CUANDO = datetime(2026, 9, 24, 10, 0)
P = "planner-local"


def _sesion(input2="input2_canales.tsv") -> Sesion:
    s = Sesion()
    s.cargar_input1(MUESTRA / "input1_objetivo.xlsx", "input1_objetivo.xlsx", P, CUANDO)
    s.cargar_input2((MUESTRA / input2).read_text(encoding="utf-8"), P, CUANDO)
    s.cargar_base(MUESTRA / "base_mes_anterior.xlsx", "base_mes_anterior.xlsx", P, CUANDO)
    return s


def _falla(fn, *args, **kwargs):
    try:
        fn(*args, **kwargs)
        return False
    except ErrorDeAjuste:
        return True


def test_sin_las_tres_entradas_no_hay_recorrido():
    s = Sesion()
    assert s.recorrido is None
    s.cargar_input1(MUESTRA / "input1_objetivo.xlsx", "input1.xlsx", P, CUANDO)
    assert s.recorrido is None
    assert s.faltan() == ["totales por canal", "mes anterior"]


def test_el_flujo_del_planner_hasta_que_cierra():
    """Carga todo, ve que no cierra por el SKU nuevo, lo apaga, corrige el input 2 y cierra."""
    s = _sesion()
    assert s.recorrido.kilos.celdas is None

    s.cambiar_sku(NUEVO, activo=False, autor=P, cuando=CUANDO, motivo="SKU nuevo sin reparto previo")
    assert [i.tipo for i in s.recorrido.kilos.inconsistencias] == ["totales_distintos"]
    assert s.recorrido.kilos.inconsistencias[0].diferencia == D("10.000")

    s.cargar_input2((MUESTRA / "input2_sin_sku_nuevo.tsv").read_text(encoding="utf-8"), P, CUANDO)
    assert s.recorrido.kilos.inconsistencias == [] and s.recorrido.plata.inconsistencias == []
    assert [a.accion for a in s.historial] == ["cargar_input1", "cargar_input2", "cargar_base", "apagar_sku",
                                               "cargar_input2"]
    assert s.historial[3].motivo == "SKU nuevo sin reparto previo"


def test_fijar_una_celda_la_respeta_y_el_resto_absorbe():
    s = _sesion("input2_sin_sku_nuevo.tsv")
    s.cambiar_sku(NUEVO, activo=False, autor=P, cuando=CUANDO, motivo="nuevo")
    sku, canal = next(k for k, v in s.recorrido.kilos.celdas.items() if v > 100)
    s.fijar("kilos", sku, canal, "100", autor=P, cuando=CUANDO, motivo="acuerdo comercial")

    r = s.recorrido.kilos
    assert r.celdas[(sku, canal)] == D("100.000")
    assert r.inconsistencias == []
    assert s.fijas("kilos")[(sku, canal)].valor == D("100.000")
    # Kilos y plata se fijan por separado (supuesto A2).
    assert (sku, canal) not in s.fijas("plata")

    s.desfijar("kilos", sku, canal, autor=P, cuando=CUANDO, motivo="se cayó el acuerdo")
    assert (sku, canal) not in s.fijas("kilos")
    assert [a.accion for a in s.historial][-2:] == ["fijar", "desfijar"]


def test_los_ajustes_sin_motivo_se_rechazan():
    s = _sesion()
    assert _falla(s.cambiar_sku, NUEVO, activo=False, autor=P, cuando=CUANDO, motivo="  ")
    assert _falla(s.cambiar_entidad, "Red Cuyo", activo=False, autor=P, cuando=CUANDO, motivo="")
    assert NUEVO not in s.apagados_skus


def test_las_ediciones_imposibles_se_rechazan_y_no_quedan_a_medias():
    s = _sesion("input2_sin_sku_nuevo.tsv")
    s.cambiar_sku(NUEVO, activo=False, autor=P, cuando=CUANDO, motivo="nuevo")
    sku, canal = next(iter(s.recorrido.kilos.celdas))
    objetivo = s.recorrido.objetivos[sku].kilos
    casos = [
        ("kilos", sku, canal, "-1"),  # negativo
        ("kilos", sku, canal, str(objetivo + 1)),  # más que el objetivo del SKU
        ("kilos", sku, canal, "1.0001"),  # más decimales que la unidad
        ("kilos", sku, canal, "mucho"),  # no es número
        ("litros", sku, canal, "1"),  # unidad desconocida
        ("kilos", "no-existe", canal, "1"),  # SKU que no está
        ("kilos", NUEVO, canal, "1"),  # SKU apagado
    ]
    for unidad, s_, c, monto in casos:
        assert _falla(s.fijar, unidad, s_, c, monto, autor=P, cuando=CUANDO, motivo="x"), (unidad, s_, c, monto)
    assert s.fijas("kilos") == {}
    assert [a.accion for a in s.historial][-1] == "apagar_sku"


def test_fijar_donde_el_sku_no_se_vende_se_rechaza():
    s = _sesion("input2_sin_sku_nuevo.tsv")
    s.cambiar_sku(NUEVO, activo=False, autor=P, cuando=CUANDO, motivo="nuevo")
    sku = next(s_ for s_, _ in s.recorrido.kilos.celdas)
    canal = next(c for c in s.recorrido.canales if (sku, c) not in s.recorrido.kilos.celdas)
    assert _falla(s.fijar, "kilos", sku, canal, "1", autor=P, cuando=CUANDO, motivo="x")


def test_apagar_un_distribuidor_queda_en_el_historial_y_mueve_la_apertura():
    s = _sesion("input2_sin_sku_nuevo.tsv")
    s.cambiar_sku(NUEVO, activo=False, autor=P, cuando=CUANDO, motivo="nuevo")
    s.cambiar_entidad("Red Cuyo", activo=False, autor=P, cuando=CUANDO, motivo="convocatoria de acreedores")
    assert "Red Cuyo" in s.recorrido.entidades_apagadas
    assert s.historial[-1].accion == "apagar_entidad" and s.historial[-1].detalle == "Red Cuyo"
    assert _falla(s.cambiar_entidad, "Nadie", activo=False, autor=P, cuando=CUANDO, motivo="x")


def test_una_entrada_que_no_se_puede_leer_no_pisa_la_anterior():
    s = _sesion()
    antes = s.recorrido
    assert _falla(s.cargar_input2, "esto no es una tabla", P, CUANDO)
    assert s.recorrido is antes


def test_apagar_un_sku_con_celdas_fijadas_no_rompe_la_sesion_y_al_prenderlo_vuelven():
    s = _sesion("input2_sin_sku_nuevo.tsv")
    s.cambiar_sku(NUEVO, activo=False, autor=P, cuando=CUANDO, motivo="nuevo")
    sku, canal = next(k for k, v in s.recorrido.kilos.celdas.items() if v > 100)
    s.fijar("kilos", sku, canal, "100", autor=P, cuando=CUANDO, motivo="acuerdo")

    s.cambiar_sku(sku, activo=False, autor=P, cuando=CUANDO, motivo="se discontinuó")
    assert s.recorrido is not None
    assert all(k[0] != sku for k in (s.recorrido.kilos.celdas or {}))
    # La sesión sigue andando: se puede seguir ajustando.
    s.cambiar_entidad("Red Cuyo", activo=False, autor=P, cuando=CUANDO, motivo="convocatoria")

    s.cambiar_sku(sku, activo=True, autor=P, cuando=CUANDO, motivo="volvió")
    s.cambiar_entidad("Red Cuyo", activo=True, autor=P, cuando=CUANDO, motivo="salió de la convocatoria")
    assert s.recorrido.kilos.celdas[(sku, canal)] == D("100.000")


def test_un_input_1_nuevo_sin_un_sku_fijado_no_rompe_la_sesion():
    from io import BytesIO

    from openpyxl import Workbook

    s = _sesion("input2_sin_sku_nuevo.tsv")
    s.cambiar_sku(NUEVO, activo=False, autor=P, cuando=CUANDO, motivo="nuevo")
    sku, canal = next(k for k, v in s.recorrido.kilos.celdas.items() if v > 100)
    s.fijar("kilos", sku, canal, "100", autor=P, cuando=CUANDO, motivo="acuerdo")

    wb = Workbook()
    wb.active.append(["SKU", "Kilos"])
    wb.active.append(["otro", 5])
    datos = BytesIO()
    wb.save(datos)
    datos.seek(0)
    s.cargar_input1(datos, "otro.xlsx", P, CUANDO)
    assert s.recorrido is not None  # no cierra (otros totales), pero no explota


def test_elegir_cual_fila_repetida_vale_se_hace_en_la_plataforma():
    s = _sesion("input2_sin_sku_nuevo.tsv")
    s.cambiar_sku(NUEVO, activo=False, autor=P, cuando=CUANDO, motivo="nuevo")
    assert any(p.tipo == "sku_repetido" for p in s.recorrido.problemas)

    s.elegir_fila("90020001", 51, autor=P, cuando=CUANDO, motivo="la fila 4 era de otro producto")
    assert s.recorrido.objetivos["90020001"].kilos == D("1.000")
    assert not any(p.tipo == "sku_repetido" for p in s.recorrido.problemas)  # resuelto: va al historial
    assert s.historial[-1].accion == "elegir_fila" and "51" in s.historial[-1].detalle
    # El objetivo cambió 7.960,420 kg: los totales por canal ya no coinciden, y se informa.
    assert [i.tipo for i in s.recorrido.kilos.inconsistencias] == ["totales_distintos"]


def test_elegir_fila_rechaza_lo_que_no_es_una_opcion():
    s = _sesion()
    assert _falla(s.elegir_fila, "90020001", 7, autor=P, cuando=CUANDO, motivo="x")  # no es una de sus filas
    assert _falla(s.elegir_fila, "90020002", 5, autor=P, cuando=CUANDO, motivo="x")  # no está repetido
    assert _falla(s.elegir_fila, "90020001", 51, autor=P, cuando=CUANDO, motivo=" ")  # sin motivo


def test_un_objetivo_nuevo_empieza_sin_elecciones():
    s = _sesion()
    s.elegir_fila("90020001", 51, autor=P, cuando=CUANDO, motivo="x")
    s.cargar_input1(MUESTRA / "input1_objetivo.xlsx", "otra vez.xlsx", P, CUANDO)
    assert s.recorrido.objetivos["90020001"].fila == 4


def test_decir_donde_se_vende_el_sku_nuevo_lo_resuelve_sin_apagarlo():
    s = _sesion()  # la muestra tal cual: el SKU nuevo frena el cruce
    s.elegir_canales(NUEVO, ["Directa (BA)"], autor=P, cuando=CUANDO, motivo="lanzamiento en BA")
    assert s.recorrido.kilos.inconsistencias == [] and s.recorrido.plata.inconsistencias == []
    assert s.recorrido.kilos.celdas[(NUEVO, "Directa (BA)")] == D("10.000")
    assert s.historial[-1].accion == "elegir_canales" and "Directa (BA)" in s.historial[-1].detalle
    # Ahora se puede fijar en ese canal aunque el mes anterior no se haya vendido ahí.
    s.fijar("kilos", NUEVO, "Directa (BA)", "10", autor=P, cuando=CUANDO, motivo="x")

    s.quitar_canales(NUEVO, autor=P, cuando=CUANDO, motivo="se postergó")
    assert s.recorrido.kilos.celdas is None  # vuelve a frenar: otra vez sin historia


def test_donde_se_vende_rechaza_lo_que_no_es_valido():
    s = _sesion()
    assert _falla(s.elegir_canales, NUEVO, [], autor=P, cuando=CUANDO, motivo="x")
    assert _falla(s.elegir_canales, NUEVO, ["Tucumán"], autor=P, cuando=CUANDO, motivo="x")
    assert _falla(s.elegir_canales, "no-existe", ["Catering"], autor=P, cuando=CUANDO, motivo="x")
    assert _falla(s.elegir_canales, NUEVO, ["Catering"], autor=P, cuando=CUANDO, motivo=" ")
    assert _falla(s.quitar_canales, NUEVO, autor=P, cuando=CUANDO, motivo="x")  # no tenía
