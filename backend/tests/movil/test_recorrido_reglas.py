"""
Reglas en el recorrido: el planner las define por canal y categorías, con un %
para kilos y otro para NNS en la misma regla (respuesta 4 del negocio). Cada %
se aplica en su cruce, independiente del otro.

Con la muestra que cierra, el café de Catering se lleva hoy el 27,22% de los
kilos y el 27,61% de la plata del canal.
"""

from decimal import Decimal as D
from pathlib import Path

from src.movil.recorrido import Regla, desde_archivos

MUESTRA = Path(__file__).parents[3] / "data" / "sample"
NUEVO = "90020900"


def _recorrido(*reglas):
    return desde_archivos(
        MUESTRA / "input1_objetivo.xlsx",
        (MUESTRA / "input2_sin_sku_nuevo.tsv").read_text(encoding="utf-8"),
        MUESTRA / "base_mes_anterior.xlsx",
        apagados={NUEVO},
        reglas=list(reglas),
    )


def _regla(id_="R1", canal="Catering", categorias=("Café",), limite="tope", kilos="20", nns="25"):
    return Regla(id=id_, canal=canal, categorias=frozenset(categorias), limite=limite,
                 kilos=None if kilos is None else D(kilos), nns=None if nns is None else D(nns))


def _parte(cruce, recorrido, canal, categoria):
    return sum((v for (s, k), v in cruce.celdas.items()
                if k == canal and recorrido.objetivos[s].categoria == categoria), D(0))


def test_la_regla_se_cumple_en_kilos_y_en_plata_cada_una_con_su_porcentaje():
    r = _recorrido(_regla())
    assert r.kilos.inconsistencias == [] and r.plata.inconsistencias == []
    total_kilos, total_plata = r.canales["Catering"].kilos, r.canales["Catering"].plata
    # La regla muerde: el café queda en el tope (redondeado para abajo a la unidad); el
    # redondeo controlado lo puede dejar a lo sumo una unidad por debajo, nunca arriba.
    tope_kilos = (total_kilos * D("0.20")).quantize(D("0.001"), "ROUND_FLOOR")
    tope_plata = (total_plata * D("0.25")).quantize(D("0.01"), "ROUND_FLOOR")
    assert tope_kilos - D("0.001") <= _parte(r.kilos, r, "Catering", "Café") <= tope_kilos
    assert tope_plata - D("0.01") <= _parte(r.plata, r, "Catering", "Café") <= tope_plata
    # Y el resto sigue cerrando exacto.
    for canal, t in r.canales.items():
        assert sum((v for (_, k), v in r.kilos.celdas.items() if k == canal), D(0)) == t.kilos, canal


def test_una_regla_solo_de_kilos_no_toca_la_plata():
    sin = _recorrido()
    con = _recorrido(_regla(nns=None))
    assert con.plata.celdas == sin.plata.celdas
    assert con.kilos.celdas != sin.kilos.celdas


def test_canal_y_categorias_se_cruzan_sin_importar_tildes_ni_mayusculas():
    exacta = _recorrido(_regla())
    escrita_distinta = _recorrido(_regla(canal="catering ", categorias=("cafe",)))
    assert escrita_distinta.kilos.celdas == exacta.kilos.celdas


def test_una_regla_de_varias_categorias_cuenta_todas():
    r = _recorrido(_regla(canal="Mayoristas", categorias=("Café", "Chocolatería"), limite="minimo",
                          kilos="50", nns=None))
    total = r.canales["Mayoristas"].kilos
    juntas = _parte(r.kilos, r, "Mayoristas", "Café") + _parte(r.kilos, r, "Mayoristas", "Chocolatería")
    minimo = (total * D("0.50")).quantize(D("0.001"), "ROUND_CEILING")  # hoy 40,79%: el mínimo muerde
    assert minimo <= juntas <= minimo + D("0.001")


def test_dos_reglas_que_chocan_se_informan_con_sus_ids():
    r = _recorrido(_regla("R1", limite="tope", kilos="10", nns=None),
                   _regla("R2", limite="minimo", kilos="15", nns=None))
    assert r.kilos.celdas is None
    assert [i.reglas for i in r.kilos.inconsistencias] == [("R1", "R2")]
    assert r.plata.celdas is not None  # en plata no hay reglas: cierra


def test_una_regla_de_un_canal_que_no_esta_se_avisa_y_no_rompe():
    r = _recorrido(_regla(canal="Tucumán"))
    assert r.kilos.celdas is not None
    assert any("R1" in p.mensaje and "Tucumán" in p.mensaje for p in r.problemas)


def test_una_categoria_que_no_tiene_ningun_sku_se_avisa():
    r = _recorrido(_regla(categorias=("Té",)))
    assert any("R1" in p.mensaje and "Té" in p.mensaje for p in r.problemas)


def test_una_regla_sobre_categorias_que_no_se_venden_en_el_canal():
    """Descartables es de Soluciones y no se vende en Catering: un tope se cumple solo, un mínimo no."""
    assert _recorrido(_regla(categorias=("Descartables",))).kilos.celdas is not None
    r = _recorrido(_regla(categorias=("Descartables",), limite="minimo", kilos="5", nns=None))
    assert [(i.tipo, i.reglas) for i in r.kilos.inconsistencias] == [("regla_incumplible", ("R1",))]
