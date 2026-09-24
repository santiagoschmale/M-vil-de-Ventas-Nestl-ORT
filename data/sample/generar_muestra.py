"""
Genera los datos de prueba del móvil: todo inventado, con la forma real.

    cd backend && .venv/bin/python ../data/sample/generar_muestra.py

Salida (en data/sample/):
- input1_objetivo.xlsx: el objetivo de Contraloría por SKU (kilos, NNS, NNS c/IIBB).
- input2_canales.tsv: los totales por canal del planner, como se pegan desde Excel
  (números con formato argentino: 13.000 y 1.234,56).
- base_mes_anterior.xlsx: cómo quedó repartido el mes anterior, SKU × canal en kilos.
  Celda vacía = no aplica; 0 = aplica con cero.
- input2_distribuidores_imposible.tsv: el ejemplo del cliente. Distribuidores pide
  más de lo que pueden darle los SKUs que se venden ahí.

Los inputs salen de un reparto "verdadero" inventado, así que filas y columnas son
compatibles: el cruce tiene solución. Casos raros a propósito:
- SKUs con objetivo en cero (obsoletos o estacionales) y un SKU nuevo sin base.
- Dos SKUs que se venden en canales de los dos segmentos.
- Un SKU de otro país, un código repetido y columnas en otro orden.
Semilla fija: correrlo dos veces da lo mismo.
"""

import random
from decimal import Decimal as D
from pathlib import Path

from openpyxl import Workbook

AQUI = Path(__file__).parent
rnd = random.Random(2026)
KG = D("0.001")
CENTAVO = D("0.01")

INGREDIENTES = ["Catering", "Vending", "Mayoristas", "KAM Ingredientes"]
SOLUCIONES = ["Distribuidores", "Directa (BA)", "Córdoba", "Rosario", "KAM Sol"]
CANALES = INGREDIENTES + SOLUCIONES
# Precio por kilo de cada canal (la plata del input 2 es por canal).
PRECIO = {c: D(rnd.randint(4000, 30000)) for c in CANALES}

PRODUCTOS_ING = ["Café soluble", "Leche en polvo", "Cacao amargo", "Crema vegetal", "Puré instantáneo",
                 "Chocolate en polvo", "Caldo concentrado"]
PRODUCTOS_SOL = ["Café en grano", "Mix capuccino", "Vaso térmico", "Tapa para vaso", "Azúcar en stick",
                 "Paletina", "Taza de servicio"]


def sku(n: int) -> str:
    return str(90020000 + n)


# ---------------------------------------------------------------------------
# Catálogo y base del mes anterior
# ---------------------------------------------------------------------------

skus: list[dict] = []
for i in range(1, 21):
    skus.append({"codigo": sku(i), "desc": f"{rnd.choice(PRODUCTOS_ING)} {rnd.choice(['1kg', '2x1kg', '5kg'])}",
                 "cat": "Ingredientes", "canales": INGREDIENTES})
for i in range(101, 126):
    skus.append({"codigo": sku(i), "desc": f"{rnd.choice(PRODUCTOS_SOL)} x{rnd.choice([50, 100, 500])}",
                 "cat": "Soluciones", "canales": SOLUCIONES})
# Dos SKUs que se venden en los dos segmentos: el cruce parte su objetivo solo.
for s in skus[18:20]:
    s["canales"] = INGREDIENTES + ["Distribuidores", "KAM Sol"]

base: dict[tuple[str, str], D] = {}
for s in skus:
    for c in s["canales"]:
        r = rnd.random()
        if r < 0.15:
            continue  # no aplica
        base[(s["codigo"], c)] = D(0) if r < 0.2 else D(rnd.randint(50, 6000))  # 0 = aplica con cero

# ---------------------------------------------------------------------------
# El reparto "verdadero" de este mes: la base movida un poco. De ahí salen los inputs.
# ---------------------------------------------------------------------------

obsoletos = {skus[3]["codigo"], skus[25]["codigo"], skus[40]["codigo"]}
verdadero = {
    k: (v * D(rnd.randint(70, 130)) / 100).quantize(KG)
    for k, v in base.items() if v > 0 and k[0] not in obsoletos
}
kilos_sku = {s["codigo"]: sum((v for (x, _), v in verdadero.items() if x == s["codigo"]), D(0)) for s in skus}
plata_celda = {k: (v * PRECIO[k[1]]).quantize(CENTAVO) for k, v in verdadero.items()}
nns_sku = {s["codigo"]: sum((v for (x, _), v in plata_celda.items() if x == s["codigo"]), D(0)) for s in skus}
kilos_canal = {c: sum((v for (_, y), v in verdadero.items() if y == c), D(0)) for c in CANALES}
plata_canal = {c: sum((v for (_, y), v in plata_celda.items() if y == c), D(0)) for c in CANALES}

# ---------------------------------------------------------------------------
# Input 1: objetivo de Contraloría (Excel)
# ---------------------------------------------------------------------------

wb = Workbook()
hoja = wb.active
hoja.title = "Objetivo"
hoja.append(["Móvil de ventas · Objetivo del mes · DATOS FICTICIOS"])
hoja.append([])
# Columnas en un orden distinto del "natural": el importador detecta por nombre.
hoja.append(["Categoría", "Descripción", "Código SKU", "NNS", "Kilos", "NNS c/IIBB", "País"])
for s in skus:
    kg, nns = kilos_sku[s["codigo"]], nns_sku[s["codigo"]]
    hoja.append([s["cat"], s["desc"], int(s["codigo"]), float(nns), float(kg),
                 float((nns * D("1.035")).quantize(CENTAVO)), "AR"])
nuevo = sku(900)  # SKU nuevo: tiene objetivo pero no estaba el mes anterior (A4)
hoja.append(["Soluciones", "Café en cápsula x50", int(nuevo), 125000.0, 10.0, 129375.0, "AR"])
hoja.append(["Ingredientes", "Leche en polvo 1kg", int(sku(950)), 0.0, 0.0, 0.0, "UY"])  # otro país, en cero
hoja.append(["Ingredientes", "Café soluble 1kg (repetido)", int(skus[0]["codigo"]), 1.0, 1.0, 1.0, "AR"])  # código repetido
wb.save(AQUI / "input1_objetivo.xlsx")

# ---------------------------------------------------------------------------
# Input 2: totales por canal (tabla pegada)
# ---------------------------------------------------------------------------


def ar(numero: D, decimales: int) -> str:
    """1234567.8 -> '1.234.567,80' (como lo pega alguien desde un Excel en español)."""
    texto = f"{numero:,.{decimales}f}"
    return texto.replace(",", "X").replace(".", ",").replace("X", ".")


def escribir_input2(nombre: str, kilos: dict[str, D], plata: dict[str, D]) -> None:
    lineas = ["Canal\tKilos\tPlata"]
    lineas += [f"{c}\t{ar(kilos[c], 3)}\t{ar(plata[c], 2)}" for c in CANALES]
    (AQUI / nombre).write_text("\n".join(lineas) + "\n", encoding="utf-8")


# El SKU nuevo suma 10 kg al input 1: se los damos a Directa para que los totales cierren.
kilos_canal_con_nuevo = dict(kilos_canal)
kilos_canal_con_nuevo["Directa (BA)"] += D(10)
plata_canal_con_nuevo = dict(plata_canal)
plata_canal_con_nuevo["Directa (BA)"] += D(125000)
escribir_input2("input2_canales.tsv", kilos_canal_con_nuevo, plata_canal_con_nuevo)

# El ejemplo del cliente: Distribuidores pide mucho más de lo que sus SKUs pueden dar.
imposible_kg = dict(kilos_canal_con_nuevo)
extra = (imposible_kg["Distribuidores"] * 3).quantize(KG)
imposible_kg["Distribuidores"] += extra
imposible_kg["Mayoristas"] -= extra
escribir_input2("input2_distribuidores_imposible.tsv", imposible_kg, plata_canal_con_nuevo)

# ---------------------------------------------------------------------------
# Base: la distribución del mes anterior (Excel SKU × canal)
# ---------------------------------------------------------------------------

wb = Workbook()
hoja = wb.active
hoja.title = "Distribución anterior"
hoja.append(["Código SKU", "Descripción"] + CANALES)
for s in skus:
    fila = [int(s["codigo"]), s["desc"]]
    for c in CANALES:
        v = base.get((s["codigo"], c))
        fila.append(None if v is None else float(v))  # vacío = no aplica
    hoja.append(fila)
wb.save(AQUI / "base_mes_anterior.xlsx")

print(f"{len(skus)} SKUs con base, {len(base)} celdas, {len(obsoletos)} en cero, 1 nuevo.")
print(f"Kilos totales: {sum(kilos_sku.values()) + 10}")
