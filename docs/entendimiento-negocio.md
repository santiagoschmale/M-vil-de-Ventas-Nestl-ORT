# Entendimiento del negocio y del flujo

POC Distribución del Móvil · Nestlé Professional Argentina · Universidad ORT

Referencia de dominio para el equipo, para el proyecto de Claude y para Claude Code.
Cada afirmación está marcada según su origen:

- **[confirmado]** lo dijo o lo mostró el cliente
- **[datos]** surge del análisis del archivo de mayo
- **[a confirmar]** hipótesis o punto abierto

---

## 1. Qué resuelve la herramienta

El planner carga sus lineamientos y **la herramienta hace el primer reparto sola**.
El planner revisa y corrige solo lo que no cierra. [confirmado]

Sin la carga de los totales por canal y de dónde se vende cada SKU, la herramienta
no resuelve el problema: la interacción sería la misma que hoy en el Excel.
[confirmado]

## 2. El flujo

```
Input 1 (Contraloría)  ─┐
Input 2 (canales)      ─┼─→  la herramienta reparte  →  inconsistencias  →  ajuste humano  →  Excel
Reglas                 ─┘
```

1. **Carga del input 1**: el objetivo del mes que manda Contraloría.
2. **Input 2**: la tabla de totales por canal. Arranca precargada con la del mes
   anterior y el planner la edita.
3. **Reglas**: heredadas del mes anterior; el planner edita, elimina o agrega.
4. **Reparto automático**: la herramienta cruza todo, partiendo del reparto del mes
   anterior.
5. **Inconsistencias**: la herramienta marca dónde los números no pueden cerrar.
6. **Ajuste humano**: el planner decide qué retocar.
7. **Aprobación y salida en Excel** para los equipos comerciales.

Los lineamientos se cargan **antes** de repartir. La corrección posterior es solo
para lo puntual. [confirmado]

---

## 3. Inputs

| | Input 1 | Input 2 |
|---|---|---|
| **Quién lo arma** | Contraloría | El planner |
| **Qué trae** | Producto (SKU), kilos, plata | Canal, kilos, plata |
| **Cómo entra** | Excel | Tabla pegada en la herramienta |
| **Frecuencia** | Mensual | Mensual, precargada con la del mes anterior |

[confirmado]

- Del input 1, lo esencial es **SKU y kilos**. [confirmado]
- En el input 2, la plata por canal la da el planner: **cada canal tiene su propio
  precio**. La herramienta no valoriza ni necesita lista de precios. [confirmado]
- **La base de partida del reparto es la distribución del mes anterior**, editable.
  [confirmado]

El archivo de mayo compartido ya viene con la distribución hecha: la hoja
"Participaciones" es el trabajo del planner, no lo que manda Contraloría.
[confirmado]

Las reglas y el ON/OFF de entidades **no son input**: son configuración que el
planner carga en la herramienta.

---

## 4. El cruce: el centro del cálculo

Los dos inputs definen una matriz. Cada fila es un SKU, cada columna un canal.

```
              Distrib.  Directa  Córdoba  ...  Mayoristas │ Total SKU
Puré             ?         ?        ?             ?       │  100 kg   ← input 1
Nesquik          ?         ?        ?             ?       │   20 kg   ← input 1
...                                                       │
──────────────────────────────────────────────────────────┤
Total canal   12.000    30.000    6.500        38.000     ← input 2
```

- Cada **fila** tiene que sumar lo que dijo Contraloría.
- Cada **columna** tiene que sumar lo que dijo el planner.
- Las celdas de un SKU en un canal donde no se vende quedan en **cero forzado**.
- Se arranca desde **el reparto del mes anterior** y se ajusta hasta cumplir filas y
  columnas.

Si las dos condiciones no pueden cumplirse a la vez, la herramienta marca dónde.
Ejemplo del cliente: si Distribuidores tiene que sumar 12.000 kg pero un producto
grande no se vende por Distribuidores, no cierra. [confirmado]

El método es el **ajuste biproporcional de matrices** (RAS / IPF): determinístico,
sin necesidad de modelos predictivos.

**Margen en los totales por canal**: el cliente mencionó un posible margen de
±500 kg. El total por SKU viene de Contraloría y cierra exacto; el total por canal
podría admitir margen. [a confirmar]

---

## 5. SKU

El **SKU es el producto**: una presentación puntual. Se identifica por su **código**
(ej. `90012345`).

| Parte | En `MARCA LÍNEA Variante 2x1kg AR` (ejemplo ilustrativo) |
|---|---|
| Marca | MARCA |
| Línea | LÍNEA |
| Variante | Variante |
| Presentación | 2x1kg: bulto de 2 unidades de 1 kg |
| País | AR |

Además tiene **categoría** (Café, Nesquik, Chocolate, LCA, Mixes, etc.).

- Mismo producto en otra presentación es otro SKU.
- **Se cruza siempre por código**, nunca por nombre.
- El objetivo se mide en **kilos**, incluso para SKUs que no se venden por peso
  (vasos, tapas, tazas). [datos]
- Los productos entran y salen con frecuencia; los vendedores y distribuidores
  cambian poco. [confirmado]

### Estados de un SKU

| Estado | Qué significa | Tratamiento |
|---|---|---|
| Normal | Tiene objetivo y reparto previo | Se reparte |
| En cero | Obsoleto o estacional [confirmado] | No se reparte |
| Sin reparto previo | SKU nuevo, no estaba el mes anterior | Regla pendiente [a confirmar] |
| No aplica | No se vende por ese canal | Cero forzado en esa celda |

"No aplica" y "aplica con cero" son estados distintos.

---

## 6. El objetivo

Por cada SKU, **kilos y plata** (NNS: facturación neta de descuentos y promociones;
NNS c/IIBB es el mismo valor con Ingresos Brutos).

Kilos y plata son la misma venta medida dos veces. No son proporcionales porque
cada SKU y cada canal tienen su precio. Cada unidad se reparte y cuadra por
separado.

---

## 7. Estructura del reparto

Nestlé Professional tiene dos segmentos.

**Ingredientes**: producto usado como insumo (puré, leche en polvo, cacao,
chocolate, café soluble). [datos] Canales: Catering, Vending, Mayoristas, KAM
Ingredientes. Cierran a nivel canal. [confirmado]

**Soluciones**: café servido (Nescafé Alegría, vasos, tapas, paletinas, azúcar en
stick, vajilla). [datos] En el input 2 se abre en Distribuidores, Directa (KAS / BA),
Córdoba, Rosario y KAM Sol. [confirmado]

```
MÓVIL
├── Ingredientes
│   ├── Mayoristas
│   ├── Vending
│   ├── Catering
│   └── KAM Ingredientes
└── Soluciones
    ├── Distribuidores → 5 distribuidores
    ├── Directa (Bs. As.)  ┐
    ├── Córdoba            ├→ vendedores
    ├── Rosario            ┘
    └── KAM Sol
```

- Los cinco componentes de Soluciones son canales del input 2. [confirmado]
- Distribuidores se abre en 5 distribuidores. [datos]
- Los vendedores cuelgan de la venta directa y los territorios, no de los
  distribuidores: la proporción directa contra distribuidores (78 / 22) coincide con
  el histórico de Call Center contra Distribuidores (77 / 23). [a confirmar]

La **profundidad es variable**: cada rama define hasta dónde se abre. [confirmado]

---

## 8. Actores

| Actor | Qué es | Relación con la herramienta |
|---|---|---|
| **Contraloría** | Define el objetivo por SKU | Fuera de la herramienta. Manda el input 1 |
| **Planner** (Sales Planning Lead) | Carga lineamientos, revisa, corrige, aprueba | **Único usuario.** ~20 concurrentes, web desktop |
| **Equipos comerciales** | Vendedores, distribuidores, finanzas | Reciben su parte en Excel |
| **Vendedor** | Empleado de Nestlé con cartera de clientes | Entidad de datos |
| **Distribuidor** | Empresa tercera que compra y revende | Entidad de datos |

Un mismo vendedor puede aparecer con un sufijo distinto según el sistema de
origen (p. ej. -SAP): 15 columnas corresponden a 12 personas. [datos]

---

## 9. Reglas

### Catálogo de tipos

La herramienta implementa **tipos de regla**; el planner crea las reglas concretas.
Un negocio nuevo usa los mismos tipos con sus propios valores, sin desarrollo.
[confirmado: las reglas son matemáticas y las define el negocio]

| Tipo | Ejemplo del cliente |
|---|---|
| **Total por canal** | Mayoristas 40.000 kg (es el input 2) |
| **Dónde se vende un SKU** | El SKU X solo se vende en Córdoba y Rosario |
| **Tope o mínimo en %** | En Córdoba ningún vendedor supera el 25% |
| **Valor fijo en kilos** | Córdoba siempre 2.500 kg |

Cada regla combina: **dónde aplica** (canal, territorio, vendedor, segmento,
categoría), **sobre qué variable** (kilos o plata) y **qué límite** (tope, mínimo,
valor fijo, permitido / no permitido).

Las reglas **se heredan de un mes al siguiente**. [confirmado]

Una regla que no entra en ningún tipo del catálogo requiere desarrollo. El cliente
envía 4 o 5 ejemplos reales para validar que el catálogo alcanza. [confirmado]

### Puntos abiertos [a confirmar]

1. **Base del porcentaje**: "25%" ¿de qué total: del canal, del territorio?
2. **Tope compartido**: "Córdoba y Buenos Aires no supera 15%", ¿cada uno o la suma?
3. **Choque entre reglas**: si dos reglas no pueden cumplirse juntas, se marca;
   ¿hay una prioridad?
4. **Kilos y plata**: ¿una regla puede aplicar sobre las dos a la vez?

---

## 10. Excepciones ON/OFF

Definido por el cliente en el documento funcional, prioridad MUST. [confirmado]

**Prender o apagar entidades** antes del reparto: SKUs, vendedores, distribuidores.
Define **quién participa** del mes. Las reglas definen cuánto le toca a cada uno.

- Distribuidor en convocatoria de acreedores: se apaga; su parte se reparte entre
  los demás.
- SKU discontinuado: se apaga.
- Vendedor nuevo o que se fue: se prende o se apaga.

---

## 11. Revisión humana

- El total por SKU **siempre cierra**: la herramienta lo garantiza.
- Lo que se marca para revisión: totales por canal que no se pueden alcanzar,
  reglas que no se pueden cumplir, conflictos entre reglas.
- El planner puede sobrescribir un valor puntual. El valor editado queda fijo y el
  resto absorbe la diferencia.
- Cada ajuste queda registrado: qué, quién, cuándo y por qué.
- El planner tiene conocimiento empírico que los datos no capturan: decide con
  criterio comercial, no solo matemático. [confirmado]

---

## 12. Ejemplo del input 2

Valores ilustrativos: misma forma que el ejemplo real del cliente, números inventados.

| Canal | Kilos | Mix |
|---|---|---|
| Distribuidores | 12.000 | 7% |
| KAM Sol | 5.000 | 3% |
| Directa (KAS / BA) | 30.000 | 17% |
| Córdoba | 6.500 | 4% |
| Rosario | 1.500 | 1% |
| Vending | 31.000 | 18% |
| Catering | 27.000 | 15% |
| Mayoristas | 38.000 | 22% |
| KAM Ingredientes | 24.000 | 14% |
| **Total** | **175.000** | |

- El total tiene que coincidir con lo que se distribuye. [confirmado]
- Para los datos de prueba, la plata usa el mismo mix que los kilos. [confirmado]
- Soluciones suma 55.000 y Ingredientes 120.000.
- Los porcentajes redondeados suman 101%: el reparto de restos (largest remainder)
  lo resuelve.

Siglas y nombres a confirmar: **KAS** y dos nombres propios del archivo (ver notas internas del equipo).

---

## 13. Estado del proyecto

- La referente de negocio deja la organización. Nestlé designa un nuevo referente
  para validar reglas y cerrar los puntos abiertos.
- Preguntas pendientes enviadas a la referente saliente.

---

## 14. Implicancias de diseño

- **Pantalla central**: carga del input 2 y de reglas, y lista de inconsistencias.
  La edición nodo por nodo es secundaria.
- **Motor de cruce**: ajuste biproporcional SKU × canal, con celdas en cero forzado,
  partiendo del reparto del mes anterior.
- **Motor de reparto** debajo del canal (distribuidor, vendedor): largest remainder
  con cuadratura exacta.
- **Catálogo de tipos de regla** como datos, no reglas en código.
- Detección y reporte de inconsistencias, sin resolución silenciosa.
- Cada nodo tiene **valor y estado** (calculado / editado).
- Importador que cruza por código de SKU.
- Canales, territorios, distribuidores, vendedores y reglas son **datos**.
