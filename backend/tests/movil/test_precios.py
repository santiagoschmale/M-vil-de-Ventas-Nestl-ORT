"""
Un SKU no vale lo mismo en todos los canales: los pesos siguen el precio que tuvo cada SKU en
cada canal el mes anterior, no un precio único de Contraloría. Los precios del móvil real salen
de su archivo (reparto del mes anterior y Participaciones); acá se cargan a mano sobre la muestra.
"""

from dataclasses import replace

from tests.movil.test_sesion import CUANDO, P, _sesion

NUEVO = "90020900"


def _cerrada():
    s = _sesion("input2_sin_sku_nuevo.tsv")
    s.cambiar_sku(NUEVO, activo=False, autor=P, cuando=CUANDO, motivo="nuevo")
    return s


def _con_precios(s, sku, caro, barato):
    """El SKU vale el doble por kilo en `caro` que en `barato`."""
    o = s.objetivos_vigentes()[sku]
    base = o.nns / o.kilos
    s._e.precios = {(sku, caro): base * 2, (sku, barato): base}
    s._sucio = True
    return s


def _un_sku_en_dos_canales(s):
    """Un SKU que se vendió en al menos dos canales el mes anterior, y esos canales."""
    por_sku = {}
    for (sku, canal), kilos in s._e.base.items():
        if kilos and sku != NUEVO:
            por_sku.setdefault(sku, []).append(canal)
    sku, canales = next((k, v) for k, v in sorted(por_sku.items()) if len(v) >= 2)
    return sku, canales[0], canales[1]


def test_proponer_pesos_usa_el_precio_del_sku_en_cada_canal():
    s = _cerrada()
    sku, caro, barato = _un_sku_en_dos_canales(s)
    antes = s.pesos_segun_kilos()
    _con_precios(s, sku, caro, barato)
    despues = s.pesos_segun_kilos()
    assert sum(despues.values()) == sum(antes.values()) == s._pide("plata")  # siguen sumando lo de Contraloría
    # El canal donde el SKU vale más se lleva más pesos que con el precio único.
    assert despues[caro] / despues[barato] > antes[caro] / antes[barato]


def test_los_pesos_se_reparten_desde_los_pesos_del_mes_anterior():
    s = _cerrada()
    s.proponer_pesos(P, CUANDO, "según los kilos")
    sku, caro, barato = _un_sku_en_dos_canales(s)
    antes = s.recorrido.plata.celdas
    _con_precios(s, sku, caro, barato)
    despues = s.recorrido.plata.celdas
    assert despues is not None  # sigue cerrando
    assert despues[(sku, caro)] / despues[(sku, barato)] > antes[(sku, caro)] / antes[(sku, barato)]
    kilos = s.recorrido.kilos.celdas
    assert kilos[(sku, caro)] and kilos[(sku, barato)]  # los kilos no cambian por los precios


def test_sin_precios_los_pesos_siguen_a_los_kilos_como_siempre():
    s = _cerrada()
    s.proponer_pesos(P, CUANDO, "según los kilos")
    assert s._e.precios == {}  # la muestra no trae precios por canal
    assert s.recorrido.plata.celdas is not None


def test_el_mes_siguiente_hereda_lo_que_valio_cada_kilo():
    s = _cerrada()
    s.proponer_pesos(P, CUANDO, "según los kilos")
    r = s.recorrido
    precios = s._precios_aprobados(r)  # lo que va en la foto para el mes siguiente
    (sku, canal), kilos = next((k, v) for k, v in sorted(r.kilos.celdas.items()) if v)
    assert precios[(sku, canal)] == r.plata.celdas[(sku, canal)] / kilos


def test_las_categorias_vacias_se_completan_con_las_del_mes_anterior():
    s = _sesion()
    sku = next(k for k, o in s.objetivos_vigentes().items() if o.categoria)
    s._e.objetivos[sku] = replace(s._e.objetivos[sku], categoria=None)
    assert s.objetivos_vigentes()[sku].categoria is None
    s._e.categorias_base = {sku: "Café"}
    assert s.objetivos_vigentes()[sku].categoria == "Café"
    s.categorias[sku] = "Asignada"  # la asignada en la herramienta manda sobre la del mes anterior
    assert s.objetivos_vigentes()[sku].categoria == "Asignada"


def test_con_precios_por_canal_proponer_pesos_cierra_en_cada_segmento():
    """Cada SKU reparte su objetivo en pesos: un segmento no se lleva plata de los SKUs del otro."""
    s = _cerrada()
    sku, caro, barato = _un_sku_en_dos_canales(s)
    _con_precios(s, sku, caro, barato)
    s.proponer_pesos(P, CUANDO, "según los kilos")
    assert s.recorrido.plata.celdas is not None  # cierra


def test_los_pesos_sugeridos_cierran_en_cada_segmento():
    """Los pesos que sugiere el diálogo de totales, guardados tal cual, cierran: ningún segmento se lleva
    pesos de los SKUs del otro, aunque cada SKU valga distinto en cada canal."""
    s = _cerrada()
    sku, caro, barato = _un_sku_en_dos_canales(s)
    _con_precios(s, sku, caro, barato)
    kilos = {c: str(t.kilos) for c, t in s.entradas.canales.items()}
    pesos = s.pesos_para(kilos)
    filas = "\n".join(f"{c}\t{kilos[c]}\t{pesos[c]}" for c in kilos)
    s.cargar_input2("Canal\tKilos\tPlata\n" + filas, P, CUANDO)
    assert s.recorrido.plata.celdas is not None
