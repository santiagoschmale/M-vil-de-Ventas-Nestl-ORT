"""
Repartir la diferencia: cuando los totales por canal no suman lo que pide Contraloría,
la herramienta sugiere cuánto sumarle o restarle a cada canal según su peso, el
planner lo revisa y lo aplica con motivo. Nada se aplica sin que cierre.
"""

from decimal import Decimal as D

from src.domain.formato import a_texto
from src.movil.sesion import ErrorDeAjuste
from tests.movil.test_sesion import CUANDO, MUESTRA, P, _falla, _sesion


def _corta():
    """Los totales por canal suman menos que el objetivo (es el del SKU nuevo, sin descontar)."""
    s = _sesion()
    texto = (MUESTRA / "input2_sin_sku_nuevo.tsv").read_text(encoding="utf-8")
    s.cargar_input2(texto, P, CUANDO)
    return s


def _valores(d, campo="sugerido"):
    return {c["canal"]: c[campo] for c in d["canales"]}


def test_la_sugerencia_reparte_la_diferencia_exacta_segun_el_peso_de_cada_canal():
    d = _corta().diferencia("kilos")
    pide, suman = D(d["pide"]), D(d["suman"])
    assert pide - suman == D("10.000")
    assert D(d["falta"]) == 0  # con la sugerencia tal cual, no falta nada
    sugeridos = [D(c["sugerido"]) for c in d["canales"]]
    assert sum(sugeridos) == pide  # cierra al gramo
    # El que tiene más recibe más.
    cambios = {c["canal"]: D(c["cambio"]) for c in d["canales"]}
    hoy = {c["canal"]: D(c["hoy"]) for c in d["canales"]}
    mayor, menor = max(hoy, key=hoy.get), min(hoy, key=hoy.get)
    assert cambios[mayor] > cambios[menor] > 0
    assert sum(D(c["peso"]) for c in d["canales"]) - 100 < 1  # el peso es un %, redondeado a un decimal
    assert d["cierra"] is True  # con la sugerencia tal cual, cierra


def test_revisar_los_valores_dice_cuanto_falta_o_sobra_sin_cambiar_nada():
    s = _corta()
    sugeridos = _valores(s.diferencia("kilos"))
    canal = next(iter(sugeridos))
    menos = dict(sugeridos, **{canal: str(D(sugeridos[canal]) - 120)})
    d = s.diferencia("kilos", menos)
    assert D(d["falta"]) == 120 and d["cierra"] is False
    mas = dict(sugeridos, **{canal: a_texto(D(sugeridos[canal]) + D("0.5"))})  # como lo escribe el planner
    d = s.diferencia("kilos", mas)
    assert D(d["falta"]) == D("-0.5") and d["cierra"] is False
    fila = next(c for c in d["canales"] if c["canal"] == canal)
    assert D(fila["cambio"]) == D(fila["sugerido"]) + D("0.5") - D(fila["hoy"])
    assert s.historial[-1].accion == "cargar_input2"  # revisar no deja rastro


def test_un_valor_que_no_es_numero_se_marca_en_su_canal():
    s = _corta()
    sugeridos = _valores(s.diferencia("kilos"))
    canal = next(iter(sugeridos))
    d = s.diferencia("kilos", dict(sugeridos, **{canal: "mucho"}))
    fila = next(c for c in d["canales"] if c["canal"] == canal)
    assert fila["error"] and d["cierra"] is False and d["falta"] is None


def test_aplicar_cambia_solo_esa_unidad_queda_en_el_historial_y_cierra():
    s = _corta()
    plata_antes = {c: t.plata for c, t in s.entradas.canales.items()}
    s.repartir_diferencia("kilos", _valores(s.diferencia("kilos")), P, CUANDO, "Contraloría ajustó el objetivo")
    assert not any(i.tipo == "totales_distintos" for i in s.recorrido.kilos.inconsistencias)
    assert {c: t.plata for c, t in s.entradas.canales.items()} == plata_antes
    ultimo = s.historial[-1]
    assert ultimo.accion == "repartir_diferencia" and ultimo.motivo == "Contraloría ajustó el objetivo"
    assert "faltaban 10,000" in ultimo.detalle


def test_no_se_aplica_si_no_cierra_ni_sin_motivo():
    s = _corta()
    sugeridos = _valores(s.diferencia("kilos"))
    canal = next(iter(sugeridos))
    assert _falla(s.repartir_diferencia, "kilos", dict(sugeridos, **{canal: "0"}), P, CUANDO, "x")
    assert _falla(s.repartir_diferencia, "kilos", sugeridos, P, CUANDO, "  ")
    assert _falla(s.repartir_diferencia, "kilos", dict(sugeridos, **{canal: "-5"}), P, CUANDO, "x")
    assert s.historial[-1].accion == "cargar_input2"


def test_si_sobra_se_resta_y_ningun_canal_queda_negativo():
    s = _sesion()
    texto = (MUESTRA / "input2_canales.tsv").read_text(encoding="utf-8").splitlines()
    # 5.000 kg de más en el primer canal.
    canal, kilos, plata = texto[1].split("\t")
    texto[1] = "\t".join([canal, a_texto(D(kilos.replace(".", "").replace(",", ".")) + 5000), plata])
    s.cargar_input2("\n".join(texto), P, CUANDO)
    d = s.diferencia("kilos")
    assert D(d["pide"]) - D(d["suman"]) == -5000
    assert sum(D(c["sugerido"]) for c in d["canales"]) == D(d["pide"])
    assert all(D(c["sugerido"]) >= 0 and D(c["cambio"]) <= 0 for c in d["canales"])


def test_deshacer_vuelve_a_los_totales_de_antes():
    s = _corta()
    antes = {c: t.kilos for c, t in s.entradas.canales.items()}
    s.repartir_diferencia("kilos", _valores(s.diferencia("kilos")), P, CUANDO, "prueba")
    s.deshacer(P, CUANDO)
    assert {c: t.kilos for c, t in s.entradas.canales.items()} == antes


def test_sin_entradas_no_hay_diferencia_que_repartir():
    from src.movil.sesion import Sesion
    try:
        Sesion().diferencia("kilos")
        assert False
    except ErrorDeAjuste:
        pass
