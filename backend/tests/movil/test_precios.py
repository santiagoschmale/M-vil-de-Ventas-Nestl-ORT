"""
Un SKU no vale lo mismo en todos los canales: los pesos siguen el precio que tuvo cada SKU en
cada canal el mes anterior, no un precio único de Contraloría. Los precios del móvil real salen
de su archivo (reparto del mes anterior y Participaciones); acá se cargan a mano sobre la muestra.
"""

from dataclasses import replace
from decimal import Decimal as D

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


def test_fijar_los_kilos_de_un_lugar_mueve_su_plata():
    s = _cerrada()
    s.proponer_pesos(P, CUANDO, "según los kilos")
    sku, canal, _ = _un_sku_en_dos_canales(s)
    kilos, plata = s.recorrido.kilos.celdas[(sku, canal)], s.recorrido.plata.celdas[(sku, canal)]
    s.fijar("kilos", sku, canal, str(kilos * 2), autor=P, cuando=CUANDO, motivo="acuerdo con el cliente")
    assert s.recorrido.plata.celdas[(sku, canal)] > plata


def _con_los_pesos_sugeridos(s):
    """Recalcular según los kilos, en Totales por canal, y guardar."""
    kilos = {c: str(t.kilos) for c, t in s.entradas.canales.items()}
    pesos = s.pesos_para(kilos)
    s.cargar_input2("Canal\tKilos\tPlata\n" + "\n".join(f"{c}\t{kilos[c]}\t{pesos.get(c, '0')}" for c in kilos),
                    P, CUANDO)
    return s.recorrido


def _lejos_del_precio(s):
    """
    Cuántos pesos le faltan o sobran a la celda más lejos de su precio. Cada SKU llega a su objetivo en
    pesos con un mismo factor en todos sus canales: lo que queda (sin lo fijado) se reparte según kilos ×
    lo que valió un kilo de ese SKU en ese canal el mes anterior.
    """
    r, precio, objetivos = s.recorrido, s._precios(), s.objetivos_vigentes()
    fijas = {k: f.valor for k, f in s.fijas("plata").items()}
    peor = D(0)
    for sku in {x for x, _ in r.kilos.celdas}:
        libres = {c: k * precio(sku, c, objetivos[sku]) for (x, c), k in r.kilos.celdas.items()
                  if x == sku and k and (x, c) not in fijas}
        resto = objetivos[sku].nns - sum((v for (x, _), v in fijas.items() if x == sku), D(0))
        for c, v in libres.items():
            peor = max(peor, abs(r.plata.celdas[(sku, c)] - resto * v / sum(libres.values())))
    return peor


def test_con_los_pesos_sugeridos_cada_lugar_queda_al_precio_de_su_canal():
    s = _cerrada()
    sku, caro, barato = _un_sku_en_dos_canales(s)
    _con_precios(s, sku, caro, barato)
    r = _con_los_pesos_sugeridos(s)
    assert _lejos_del_precio(s) <= D("0.01")  # salvo el redondeo al centavo
    por_kilo = {c: r.plata.celdas[(sku, c)] / r.kilos.celdas[(sku, c)] for c in (caro, barato)}
    assert abs(por_kilo[caro] / por_kilo[barato] - 2) < D("0.0001")  # vale el doble, como el mes anterior


def test_fijar_kilos_y_recalcular_los_pesos_vuelve_cada_lugar_a_su_precio():
    s = _cerrada()
    sku, caro, barato = _un_sku_en_dos_canales(s)
    _con_precios(s, sku, caro, barato)
    _con_los_pesos_sugeridos(s)
    fijado = s.recorrido.kilos.celdas[(sku, caro)] * 2
    s.fijar("kilos", sku, caro, str(fijado), autor=P, cuando=CUANDO, motivo="acuerdo con el cliente")
    r = _con_los_pesos_sugeridos(s)
    assert r.kilos.celdas[(sku, caro)] == fijado
    assert _lejos_del_precio(s) <= D("0.01")


def test_la_plata_fijada_se_respeta_y_el_resto_del_sku_sigue_su_precio():
    s = _cerrada()
    sku, caro, barato = _un_sku_en_dos_canales(s)
    _con_precios(s, sku, caro, barato)
    r = _con_los_pesos_sugeridos(s)
    fijado = (r.plata.celdas[(sku, caro)] / 2).quantize(D("0.01"))
    s.fijar("plata", sku, caro, str(fijado), autor=P, cuando=CUANDO, motivo="acuerdo con el cliente")
    r = _con_los_pesos_sugeridos(s)
    assert r.plata.celdas[(sku, caro)] == fijado
    assert _lejos_del_precio(s) <= D("0.01")


def test_un_sku_nuevo_va_solo_a_sus_canales_elegidos_y_a_su_precio():
    s = _sesion()
    s.elegir_canales(NUEVO, ["Catering", "Vending"], autor=P, cuando=CUANDO, motivo="SKU nuevo")
    r = _con_los_pesos_sugeridos(s)
    assert {c for (x, c), v in r.plata.celdas.items() if x == NUEVO and v} == {"Catering", "Vending"}
    assert _lejos_del_precio(s) <= D("0.01")
