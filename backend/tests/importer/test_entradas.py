"""
Tests de los importadores: input 1 (Excel de Contraloría), input 2 (tabla pegada)
y base (reparto del mes anterior). Contra los datos ficticios de data/sample y
contra casos armados a mano.
"""

from decimal import Decimal as D
from io import BytesIO
from pathlib import Path

from openpyxl import Workbook

from src.importer.entradas import ErrorDeEntrada, leer_base, leer_input1, leer_input2, numero

MUESTRA = Path(__file__).parents[3] / "data" / "sample"


def _mensajes(problemas, severidad=None):
    return [p.mensaje for p in problemas if severidad in (None, p.severidad)]


def _excel(filas):
    wb = Workbook()
    for f in filas:
        wb.active.append(f)
    datos = BytesIO()
    wb.save(datos)
    datos.seek(0)
    return datos


def _falla(fn, *args):
    try:
        fn(*args)
        return False
    except ErrorDeEntrada:
        return True


# ---------------------------------------------------------------------------
# Números pegados
# ---------------------------------------------------------------------------

def test_numeros_en_formato_argentino_y_con_punto_decimal():
    assert numero("13.000") == D("13000")
    assert numero("1.234.567,89") == D("1234567.89")
    assert numero("1234,5") == D("1234.5")
    assert numero("1234.5") == D("1234.5")
    assert numero("1234.567") == D("1234.567")  # 4 dígitos antes del punto: no es separador de miles
    assert numero(" 500 ") == D("500")
    assert numero("-12,5") == D("-12.5")


def test_lo_que_no_es_numero_no_se_adivina():
    for texto in ("abc", "", "1,2,3", "1.23.4", "#N/A", "12 kg"):
        assert numero(texto) is None, texto


# ---------------------------------------------------------------------------
# Input 1
# ---------------------------------------------------------------------------

def test_input1_de_muestra():
    objetivo, problemas = leer_input1(MUESTRA / "input1_objetivo.xlsx")
    assert len(objetivo) == 47  # 45 con base + el nuevo + el de otro país; el repetido no suma
    assert all(isinstance(o.kilos, D) for o in objetivo.values())
    assert any("repetido" in m for m in _mensajes(problemas, "error"))
    assert any("otro país" in m for m in _mensajes(problemas, "aviso"))
    assert sum(1 for m in _mensajes(problemas, "aviso") if "en cero" in m) == 4


def test_input1_detecta_columnas_por_nombre_en_cualquier_orden():
    objetivo, _ = leer_input1(_excel([["KILOS", "Nns", "Código  SKU"], [100, 2000, 1]]))
    assert objetivo["1"].kilos == D("100") and objetivo["1"].nns == D("2000")


def test_input1_sin_nns_se_puede_leer_porque_lo_esencial_es_sku_y_kilos():
    objetivo, problemas = leer_input1(_excel([["SKU", "Kilos"], ["1", 10]]))
    assert objetivo["1"].nns is None
    assert any("NNS" in m for m in _mensajes(problemas, "aviso"))


def test_input1_sin_kilos_no_se_puede_leer():
    assert _falla(leer_input1, _excel([["SKU", "NNS"], ["1", 10]]))


def test_input1_valores_rotos_se_reportan():
    objetivo, problemas = leer_input1(_excel([["SKU", "Kilos"], ["1", -5], ["2", "#N/A"], ["3", 1.23456]]))
    errores = _mensajes(problemas, "error")
    assert any("negativo" in m for m in errores)
    assert any("#N/A" in m for m in errores)
    assert objetivo["3"].kilos == D("1.235")  # se redondea al gramo y se avisa
    assert any("decimales" in m for m in _mensajes(problemas, "aviso"))


# ---------------------------------------------------------------------------
# Input 2
# ---------------------------------------------------------------------------

def test_input2_de_muestra():
    canales, problemas = leer_input2((MUESTRA / "input2_canales.tsv").read_text(encoding="utf-8"))
    assert len(canales) == 9
    assert problemas == []
    assert all(c.plata is not None for c in canales.values())


def test_input2_acepta_tabulaciones_punto_y_coma_o_comas():
    tsv = "Canal\tKilos\tPlata\nMayoristas\t40.000\t1.000.000,50\n"
    pyc = "Canal;Kilos;Plata\nMayoristas;40.000;1.000.000,50\n"
    for texto in (tsv, pyc):
        canales, _ = leer_input2(texto)
        assert canales["Mayoristas"].kilos == D("40000")
        assert canales["Mayoristas"].plata == D("1000000.50")


def test_input2_canal_repetido_y_numero_roto():
    canales, problemas = leer_input2("Canal\tKilos\nA\t10\nA\t20\nB\tmucho\n")
    errores = _mensajes(problemas, "error")
    assert canales["A"].kilos == D("10")
    assert any("repetido" in m for m in errores)
    assert any("B" in m for m in errores)


def test_input2_sin_encabezado_reconocible_no_se_puede_leer():
    assert _falla(leer_input2, "Mayoristas\t40000\n")


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------

def test_base_de_muestra():
    base, problemas = leer_base(MUESTRA / "base_mes_anterior.xlsx")
    # Cuenta independiente: celdas no vacías del Excel, leído directo.
    from openpyxl import load_workbook

    filas = list(load_workbook(MUESTRA / "base_mes_anterior.xlsx").active.iter_rows(values_only=True))
    no_vacias = sum(1 for f in filas[1:] for v in f[2:] if v is not None)
    assert len(base) == no_vacias > 100
    assert any(v == 0 for v in base.values())  # aplica con cero
    assert problemas == []


def test_base_vacio_es_no_aplica_y_cero_es_aplica_con_cero():
    base, _ = leer_base(_excel([["Código SKU", "Descripción", "X", "Y", "Z"], [1, "algo", 10, None, 0]]))
    assert base == {("1", "X"): D("10"), ("1", "Z"): D("0")}


def test_base_negativos_y_textos_se_reportan_y_no_se_usan():
    base, problemas = leer_base(_excel([["SKU", "X", "Y"], ["1", -3, "#N/A"], ["1", 5, 5]]))
    errores = _mensajes(problemas, "error")
    assert base == {}
    assert any("negativ" in m for m in errores)
    assert any("#N/A" in m for m in errores)
    assert any("repetido" in m for m in errores)
