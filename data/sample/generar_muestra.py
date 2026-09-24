"""
Genera los datos de prueba del móvil: todo inventado, con la forma real.

    cd backend && .venv/bin/python ../data/sample/generar_muestra.py

Salida (en data/sample/):
- input1_objetivo.xlsx: el objetivo de Contraloría por SKU (kilos, NNS, NNS c/IIBB).
- input2_canales.tsv: los totales por canal del planner, como se pegan desde Excel
  (números con formato argentino: 13.000 y 1.234,56).
- base_mes_anterior.xlsx: cómo quedó repartido el mes anterior, SKU × canal en kilos.
  Celda vacía = no aplica; 0 = aplica con cero.
  Segunda hoja "Apertura anterior": cómo se abrió cada celda debajo del canal
  (SKU, canal, entidad, kilos): distribuidores en Distribuidores, vendedores en
  Directa, Córdoba y Rosario (supuesto A10: cada territorio con sus vendedores).
- input2_sin_sku_nuevo.tsv: el input 2 sin el SKU nuevo. Con --apagar 90020900 el
  móvil cierra.
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
import re
import zipfile
from datetime import datetime
from decimal import Decimal as D
from pathlib import Path

from openpyxl import Workbook

AQUI = Path(__file__).parent
rnd = random.Random(2026)
KG = D("0.001")
CENTAVO = D("0.01")
FECHA = datetime(2026, 9, 1)  # fija: regenerar da los mismos bytes


def guardar(libro, nombre: str) -> None:
    """
    Guarda el Excel con fechas fijas. Un .xlsx es un zip: cada archivo interno lleva la
    hora de escritura y docProps/core.xml la fecha de modificado. Sin fijar las dos,
    dos corridas dan bytes distintos.
    """
    libro.properties.created = libro.properties.modified = FECHA
    ruta = AQUI / nombre
    libro.save(ruta)
    with zipfile.ZipFile(ruta) as z:
        partes = [(i.filename, z.read(i.filename)) for i in z.infolist()]
    # openpyxl pisa la fecha de modificado con la hora actual al guardar: se vuelve a fijar.
    iso = FECHA.strftime("%Y-%m-%dT%H:%M:%SZ").encode()
    partes = [
        (n, re.sub(rb"(<dcterms:modified[^>]*>)[^<]*(</dcterms:modified>)", rb"\g<1>" + iso + rb"\g<2>", d)
         if n == "docProps/core.xml" else d)
        for n, d in partes
    ]
    with zipfile.ZipFile(ruta, "w", zipfile.ZIP_DEFLATED) as z:
        for nombre_parte, datos in partes:
            z.writestr(zipfile.ZipInfo(nombre_parte, date_time=FECHA.timetuple()[:6]), datos,
                       compress_type=zipfile.ZIP_DEFLATED)

INGREDIENTES = ["Catering", "Vending", "Mayoristas", "KAM Ingredientes"]
SOLUCIONES = ["Distribuidores", "Directa (BA)", "Córdoba", "Rosario", "KAM Sol"]
CANALES = INGREDIENTES + SOLUCIONES
# Precio por kilo de cada canal (la plata del input 2 es por canal).
PRECIO = {c: D(rnd.randint(4000, 30000)) for c in CANALES}

DISTRIBUIDORES = ["Distribuidora Andina", "Distribuidora del Litoral", "Comercial Pampa", "Red Cuyo",
                  "Norte Servicios"]
# Supuesto A10: los vendedores cuelgan de la venta directa y de cada territorio.
VENDEDORES = {
    "Directa (BA)": ["Lucía Ferreyra", "Tomás Quiroga", "Valentina Sosa", "Martín Acosta", "Camila Benítez"],
    "Córdoba": ["Joaquín Ledesma", "Sofía Correa", "Nicolás Paz"],
    "Rosario": ["Agustina Medina", "Federico Luna"],
}
APERTURA = {"Distribuidores": DISTRIBUIDORES, **VENDEDORES}

PRODUCTOS_ING = ["Café soluble", "Leche en polvo", "Cacao amargo", "Crema vegetal", "Puré instantáneo",
                 "Chocolate en polvo", "Caldo concentrado"]
PRODUCTOS_SOL = ["Café en grano", "Mix capuccino", "Vaso térmico", "Tapa para vaso", "Azúcar en stick",
                 "Paletina", "Taza de servicio"]
# La categoría del input 1 (sobre la que se arman las reglas), por producto.
CATEGORIA = {
    "Café soluble": "Café", "Café en grano": "Café", "Mix capuccino": "Café", "Café en cápsula": "Café",
    "Leche en polvo": "Lácteos", "Crema vegetal": "Lácteos",
    "Cacao amargo": "Chocolatería", "Chocolate en polvo": "Chocolatería",
    "Puré instantáneo": "Culinarios", "Caldo concentrado": "Culinarios",
    "Vaso térmico": "Descartables", "Tapa para vaso": "Descartables", "Paletina": "Descartables",
    "Azúcar en stick": "Endulzantes", "Taza de servicio": "Vajilla",
}


def sku(n: int) -> str:
    return str(90020000 + n)


# ---------------------------------------------------------------------------
# Catálogo y base del mes anterior
# ---------------------------------------------------------------------------

skus: list[dict] = []
for i in range(1, 21):
    producto = rnd.choice(PRODUCTOS_ING)
    skus.append({"codigo": sku(i), "desc": f"{producto} {rnd.choice(['1kg', '2x1kg', '5kg'])}",
                 "cat": CATEGORIA[producto], "canales": INGREDIENTES})
for i in range(101, 126):
    producto = rnd.choice(PRODUCTOS_SOL)
    skus.append({"codigo": sku(i), "desc": f"{producto} x{rnd.choice([50, 100, 500])}",
                 "cat": CATEGORIA[producto], "canales": SOLUCIONES})
# Dos SKUs que se venden en los dos segmentos: el cruce parte su objetivo solo.
for s in skus[18:20]:
    s["canales"] = INGREDIENTES + ["Distribuidores", "KAM Sol"]

# Como en el ejemplo del cliente: hay SKUs grandes que no se venden por Distribuidores.
for s in skus[20:45:2]:
    s["canales"] = [c for c in s["canales"] if c != "Distribuidores"]

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
hoja.append(["Café", "Café en cápsula x50", int(nuevo), 125000.0, 10.0, 129375.0, "AR"])
hoja.append(["Lácteos", "Leche en polvo 1kg", int(sku(950)), 0.0, 0.0, 0.0, "UY"])  # otro país, en cero
hoja.append(["Café", "Café soluble 1kg (repetido)", int(skus[0]["codigo"]), 1.0, 1.0, 1.0, "AR"])  # código repetido
guardar(wb, "input1_objetivo.xlsx")

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
# Lo que haría el planner si apaga el SKU nuevo: saca sus 10 kg (y su plata) de Directa.
escribir_input2("input2_sin_sku_nuevo.tsv", kilos_canal, plata_canal)

# El ejemplo del cliente: el planner le pide a Distribuidores 1.000 kg más de lo que
# pueden darle todos los SKUs que se venden ahí juntos, y se lo saca a los otros canales
# de Soluciones, en proporción, para que los dos inputs sigan sumando lo mismo.
skus_distribuidores = {x for (x, c), v in base.items() if c == "Distribuidores" and v > 0 and x not in obsoletos}
pueden = sum(kilos_sku[x] for x in skus_distribuidores)
imposible_kg = dict(kilos_canal_con_nuevo)
extra = pueden + D(1000) - imposible_kg["Distribuidores"]
imposible_kg["Distribuidores"] += extra
otros = [c for c in SOLUCIONES if c != "Distribuidores"]
total_otros = sum(imposible_kg[c] for c in otros)
assert extra < total_otros, "el caso imposible no entra en los otros canales de Soluciones"
restado = D(0)
for c in otros[:-1]:
    parte = (extra * imposible_kg[c] / total_otros).quantize(KG)
    imposible_kg[c] -= parte
    restado += parte
imposible_kg[otros[-1]] -= extra - restado
assert all(v >= 0 for v in imposible_kg.values())
assert sum(imposible_kg.values()) == sum(kilos_canal_con_nuevo.values())
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

# Apertura debajo del canal, en formato largo. Una entidad que no figura en una celda
# no aplica ahí; una con 0 aplica con cero.
apertura = wb.create_sheet("Apertura anterior")
apertura.append(["Código SKU", "Canal", "Entidad", "Kilos"])
for (codigo, canal), v in sorted(base.items()):
    if canal not in APERTURA or v == 0:
        continue
    for entidad in APERTURA[canal]:
        r = rnd.random()
        if r < 0.2:
            continue  # no aplica
        apertura.append([int(codigo), canal, entidad, 0.0 if r < 0.25 else float(rnd.randint(10, 900))])
guardar(wb, "base_mes_anterior.xlsx")

print(f"{len(skus)} SKUs con base, {len(base)} celdas, {len(obsoletos)} en cero, 1 nuevo.")
print(f"Kilos totales: {sum(kilos_sku.values()) + 10}")
