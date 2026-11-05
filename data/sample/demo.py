"""
Prepara Postgres para una demo: borra todo, deja dos años de móviles aprobados con la
muestra (nov 2024 a oct 2026) y el mes siguiente con el objetivo y el mes anterior,
sin los totales por canal, para armarlos en vivo, y el SKU nuevo apagado.

    make demo      (después: make dev-db)

Con la API levantada, reiniciarla después: guarda los meses en memoria.
"""

import sys
from datetime import date, datetime
from os import environ
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from fastapi import Depends, FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from src.auth.proveedor import ProveedorLocal  # noqa: E402
from src.movil.almacen import Almacen  # noqa: E402
from src.movil.repositorio import Repositorio  # noqa: E402
from src.routes import movil  # noqa: E402

MESES = 24
DESDE = date(2024, 11, 1)


def main() -> None:
    repo = Repositorio(Almacen(environ["DATABASE_URL"]), hoy=lambda: DESDE)
    repo.reiniciar()
    app = FastAPI()
    app.state.repositorio, app.state.autenticacion = repo, ProveedorLocal()
    app.include_router(movil.router, dependencies=[Depends(movil.autor)])
    c = TestClient(app, raise_server_exceptions=True)

    def ok(r):
        assert r.status_code == 200, r.text
        return r.json()

    def cerrar_y_aprobar(mes):
        for etapa in ("canal", "apertura"):
            ok(c.post(f"/api/movil/etapas/{etapa}?mes={mes}"))
        ok(c.post(f"/api/movil/aprobar?mes={mes}"))

    # El primero, como lo arma un planner: totales del mes anterior, SKU nuevo, kilos ajustados a Contraloría
    # y pesos según los kilos, como en el diálogo de Totales por canal.
    _fecha(DESDE)
    mes = ok(c.post("/api/movil/muestra?totales=false"))["mes"]
    sug = ok(c.get("/api/movil"))["entradas"]["base"]["canales"]
    ok(c.put("/api/movil/input2", json={"texto": "Canal\tKilos\tPlata\n" + "\n".join(
        f"{s['canal']}\t{s['kilos']}\t" for s in sug)}))
    ok(c.put("/api/movil/skus/90020900/canales", json={"canales": ["Catering", "Vending"], "motivo": "SKU nuevo"}))
    kilos = ok(c.post("/api/movil/totales/revisar", json={"kilos": {s["canal"]: s["kilos"] for s in sug}}))["kilos"]["ajustados"]
    pesos = ok(c.post("/api/movil/totales/pesos/sugeridos", json={"valores": kilos}))["pesos"]
    ok(c.put("/api/movil/input2", json={"motivo": "Contraloría ajustó el objetivo", "texto": "Canal\tKilos\tPlata\n" + "\n".join(
        f"{c_}\t{kilos[c_]}\t{pesos[c_]}" for c_ in kilos)}))
    cerrar_y_aprobar(mes)

    # Los siguientes heredan todo: con el objetivo nuevo ya cierran.
    for i in range(1, MESES):
        _fecha(date(DESDE.year + (DESDE.month + i - 1) // 12, (DESDE.month + i - 1) % 12 + 1, 1))
        mes = ok(c.post("/api/movil/meses/siguiente"))["mes"]
        ok(c.post(f"/api/movil/muestra?solo_objetivo=true&mes={mes}"))
        cerrar_y_aprobar(mes)
        print(mes, "aprobado")

    # El de la demo: objetivo y mes anterior, sin totales por canal.
    mes = ok(c.post("/api/movil/meses/siguiente"))["mes"]
    ok(c.post(f"/api/movil/muestra?totales=false&mes={mes}"))
    # El SKU nuevo ya se mostró en otra demo: apagado, no aparece en Para revisar.
    ok(c.put(f"/api/movil/skus/90020900?mes={mes}", json={"activo": False, "motivo": "Entra el mes que viene"}))
    print(mes, "listo para la demo")


def _fecha(dia: date) -> None:
    # El historial de cada mes queda con fechas de ese mes, no todas de hoy.
    movil._ahora = lambda: datetime(dia.year, dia.month, 25, 10, 0)


if __name__ == "__main__":
    main()
