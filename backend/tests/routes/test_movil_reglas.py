"""
Reglas por HTTP: alta, edición y baja con motivo, los % como texto, y el estado
con las reglas, las opciones para el formulario y a qué reglas apunta cada
inconsistencia.
"""

from pathlib import Path

from fastapi.testclient import TestClient

from app import crear_app

MUESTRA = Path(__file__).parents[3] / "data" / "sample"
NUEVO = "90020900"
REGLA = {"canal": "Catering", "categorias": ["Café"], "limite": "tope", "kilos": "20", "nns": "25",
         "motivo": "acuerdo con la cadena"}


def _cerrado():
    c = TestClient(crear_app())
    with (MUESTRA / "input1_objetivo.xlsx").open("rb") as f:
        c.post("/api/movil/input1", files={"archivo": ("input1.xlsx", f)})
    c.put("/api/movil/input2", json={"texto": (MUESTRA / "input2_sin_sku_nuevo.tsv").read_text(encoding="utf-8")})
    with (MUESTRA / "base_mes_anterior.xlsx").open("rb") as f:
        c.post("/api/movil/base", files={"archivo": ("base.xlsx", f)})
    c.put(f"/api/movil/skus/{NUEVO}", json={"activo": False, "motivo": "nuevo"})
    return c


def test_agregar_una_regla_la_devuelve_en_el_estado():
    c = _cerrado()
    r = c.post("/api/movil/reglas", json=REGLA)
    assert r.status_code == 200, r.json()
    (regla,) = r.json()["reglas"]
    assert regla["id"] == "R1"
    assert regla["categorias"] == ["Café"] and regla["limite"] == "tope"
    assert regla["kilos"] == "20" and regla["nns"] == "25"  # texto, no número
    assert regla["motivo"] == "acuerdo con la cadena" and regla["autor"] == "planner-local"
    assert r.json()["cierra"] == {"kilos": True, "plata": True}


def test_el_estado_trae_las_opciones_del_formulario():
    opciones = _cerrado().get("/api/movil").json()["opciones"]
    assert "Catering" in opciones["canales"] and len(opciones["canales"]) == 9
    assert opciones["categorias"] == sorted(opciones["categorias"])
    assert {"Café", "Chocolatería"} <= set(opciones["categorias"])


def test_una_regla_sin_un_porcentaje_va_con_null():
    c = _cerrado()
    r = c.post("/api/movil/reglas", json={**REGLA, "nns": None})
    assert r.json()["reglas"][0]["nns"] is None


def test_los_porcentajes_como_numero_json_se_rechazan():
    r = _cerrado().post("/api/movil/reglas", json={**REGLA, "kilos": 20})
    assert r.status_code == 422


def test_una_regla_mal_cargada_da_422_con_el_motivo():
    r = _cerrado().post("/api/movil/reglas", json={**REGLA, "kilos": "150"})
    assert r.status_code == 422
    assert "entre 0 y 100" in r.json()["detail"]


def test_un_conflicto_dice_que_reglas_chocan():
    c = _cerrado()
    c.post("/api/movil/reglas", json={**REGLA, "kilos": "10", "nns": None})
    estado = c.post("/api/movil/reglas", json={**REGLA, "limite": "minimo", "kilos": "15", "nns": None}).json()
    assert estado["cierra"]["kilos"] is False
    (inc,) = estado["inconsistencias"]["kilos"]
    assert inc["tipo"] == "reglas_en_conflicto"
    assert inc["reglas"] == ["R1", "R2"]


def test_editar_y_eliminar():
    c = _cerrado()
    c.post("/api/movil/reglas", json=REGLA)
    r = c.put("/api/movil/reglas/R1", json={**REGLA, "kilos": "30", "motivo": "subió"})
    assert r.status_code == 200 and r.json()["reglas"][0]["kilos"] == "30"
    assert c.put("/api/movil/reglas/R9", json=REGLA).status_code == 422
    assert c.request("DELETE", "/api/movil/reglas/R1", json={"motivo": ""}).status_code == 422
    r = c.request("DELETE", "/api/movil/reglas/R1", json={"motivo": "se cayó"})
    assert r.status_code == 200 and r.json()["reglas"] == []
    assert [a["accion"] for a in r.json()["historial"][-3:]] == ["agregar_regla", "editar_regla", "eliminar_regla"]
