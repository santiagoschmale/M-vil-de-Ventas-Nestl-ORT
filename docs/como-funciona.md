# Cómo funciona el backend del móvil

Qué hace cada pieza, a quién le habla y qué le pasa. Para leer antes de tocar el
backend. El detalle fino (supuestos, gotchas, cómo correrlo) está en
[`backend/src/domain/NOTES.md`](../backend/src/domain/NOTES.md).

## El camino de un pedido

Ejemplo: el planner apaga un SKU desde la pantalla.

```
pantalla ──PUT /api/movil/skus/123──▶ routes/movil.py
                                          │  pide: la sesión (repositorio) y quién es (auth)
                                          ▼
                                     movil/sesion.py      cambiar_sku(...)
                                          │  guarda una copia, aplica el cambio, recalcula todo
                                          ▼
                                     movil/recorrido.py   armar(...)
                                          │  prepara los datos
                                          ├──▶ domain/cruce.py     kilos      (usa domain/flujo.py)
                                          ├──▶ domain/cruce.py     plata      (usa domain/flujo.py)
                                          └──▶ domain/apertura.py  cada celda (usa domain/reparto.py)
                                          ▼
pantalla ◀──── estado nuevo (JSON) ─── routes/movil.py
```

Todo cambio hace este camino completo. No se recalcula "solo lo que cambió": se
recalcula el mes entero. Es rápido y así nunca queda nada desactualizado.

## Cada pieza y su responsabilidad

### `app.py` — arma la aplicación

Crea la app y decide dos cosas: dónde vive el móvil (el **repositorio**) y cómo se
sabe quién es el usuario (la **autenticación**). Registra un solo middleware,
`catch_exceptions`, que convierte un error inesperado en una respuesta prolija en vez
de una traza.

### `routes/movil.py` — la puerta de entrada

Cada endpoint hace siempre lo mismo:

1. Pide dos cosas a FastAPI con `Depends`. No son middleware: son funciones que
   FastAPI llama antes del endpoint y le pasa el resultado.
   - `sesion`: el móvil, sacado del repositorio.
   - `autor`: quién hace el pedido. Hoy siempre es `"planner-local"`
     ([`auth/proveedor.py`](../backend/src/auth/proveedor.py)); con Entra ID se cambia
     solo ese archivo.
2. Llama al método de la sesión que corresponde, con el autor, la hora y el motivo.
3. Si la sesión rechaza el cambio (`ErrorDeAjuste`), responde 422 con el mensaje
   para el planner. Si sale bien, devuelve el estado entero con `_estado`.

No hace cuentas ni decide reglas de negocio: traduce HTTP a llamadas a la sesión, y
la sesión a JSON.

### `movil/repositorio.py` — dónde vive el móvil

Hoy es **un solo móvil en la memoria del servidor**, compartido por todos, con un
candado para que dos pedidos no lo toquen a la vez. Si el servidor se reinicia, se
pierde. Cuando llegue Postgres, se cambia esta pieza y el resto no se entera.

### `movil/sesion.py` — el móvil del mes

Guarda lo que cargó y decidió el planner:

- las tres entradas;
- los SKUs y entidades apagados;
- las celdas fijadas;
- las reglas;
- las filas elegidas y "dónde se vende";
- el historial.

Cada método (fijar, apagar, agregar una regla, cargar un archivo…) valida lo que
recibe y arma su cambio. Después todos pasan por el mismo lugar, `_aplicar`:

1. Guarda una copia del estado.
2. Aplica el cambio.
3. Recalcula todo llamando al recorrido. Si todavía falta alguna de las tres
   entradas, no recalcula: no hay reparto.
4. Si algo falló, vuelve a la copia: no queda nada a medias.
5. Si salió bien, anota el ajuste en el historial (qué, quién, cuándo, por qué) y
   guarda la copia para poder deshacer.

**Deshacer** vuelve a esa copia una sola vez. No borra el historial: suma un ajuste
"Deshizo: …". Después se deshabilita hasta el próximo cambio.

La sesión es la que dice que no a lo imposible. Por ejemplo: un monto negativo, mayor
que el objetivo o con más decimales que la unidad, o fijar donde el SKU no se vende.

### `movil/recorrido.py` — prepara los datos y encadena las cuentas

`armar` recibe todo lo que tiene la sesión y:

1. **Empareja los canales por nombre**, sin importar tildes, mayúsculas ni espacios:
   "Cordoba" de un archivo es "Córdoba" del otro.
2. **Deja afuera** los SKUs apagados y los que tienen 0 kg.
3. Aplica **"Dónde se vende"**:
   - A un SKU nuevo le da un punto de partida en los canales elegidos.
   - A uno con historia lo limita a esos canales.
4. Convierte las **reglas** en grupos que entiende el cruce, una lista para kilos y
   otra para plata.
5. Avisa lo que sobra, por ejemplo un SKU del mes anterior que no está en el objetivo.
6. Llama al **cruce dos veces, por separado**: una para kilos y otra para plata. La
   de plata solo corre si todos los SKUs y canales tienen importes.
7. Si el cruce de kilos dio reparto, **abre cada celda** debajo del canal.

También escribe el Excel de salida (`exportar`) y es la línea de comandos para
probar sin pantalla.

### `domain/cruce.py` — el reparto SKU × canal

Recibe tres cosas:

- **Filas**: lo que tiene que sumar cada SKU (el objetivo de Contraloría).
- **Columnas**: lo que tiene que sumar cada canal.
- **Base**: cómo fue el mes anterior.

Con eso devuelve la tabla, que cumple las dos sumas exactas y se parece lo más
posible al mes anterior. Respeta las celdas fijadas y las reglas.

Si no se puede, no inventa nada: devuelve **inconsistencias** que explican por qué y
qué hacer. Por ejemplo: totales que no coinciden, un SKU sin canal o reglas que
chocan.

### `domain/flujo.py` — la herramienta de cálculo del cruce

Resuelve problemas de flujo en redes (flujo máximo y de costo mínimo). El cruce lo
usa para tres cosas:

- Saber si todo se puede cumplir a la vez antes de intentarlo.
- Encontrar qué reglas son las que chocan.
- Redondear al gramo y al centavo sin que se descuadre ninguna suma.

No sabe nada de SKUs ni canales: son números y nodos.

### `domain/apertura.py` y `domain/reparto.py` — debajo del canal

`apertura` toma el valor de una celda (SKU × canal) y lo reparte entre las entidades
de ese canal. Respeta las entidades apagadas (lo suyo va a las demás) y las fijadas a
mano. Para repartir usa `reparto`, que divide un total según pesos, con el método de
los mayores restos: la suma da exacto, sin perder ni un gramo.

**Qué canales se abren lo decide el Excel del mes anterior, no el código.** Se abre
todo canal que tenga filas de apertura, con los pesos de ese mes. En la muestra
(ficticia):

| Canal | Se abre en |
|---|---|
| Distribuidores | 5 distribuidores |
| Directa (BA) | 5 vendedores |
| Córdoba | 3 vendedores |
| Rosario | 2 vendedores |

Hoy se arma **un nivel** debajo del canal. `apertura` soporta más niveles (por
ejemplo distribuidor → vendedor), pero el recorrido arma uno porque el archivo trae
uno. Qué canales se abren en la realidad y cuántos niveles hay está para confirmar
con el archivo real del cliente.

### `domain/formato.py` y `domain/problema.py`

- `formato`: escribe los montos como en Argentina (1.234,5).
- `problema`: el aviso de algo raro en los datos, con su color:
  - **Rojo**: bloquea exportar.
  - **Amarillo**: se puede exportar igual, después de confirmar.

### `importer/entradas.py` — leer los archivos

Lee los tres Excel (y los totales por canal también como tabla de texto) y devuelve
datos limpios más una lista de problemas encontrados. No decide nada: si un SKU está
repetido, usa la primera fila y avisa, y el planner elige cuál vale en la pantalla.

## Quién conoce a quién

- `domain/` no conoce FastAPI, ni la base, ni Excel: son cuentas puras y se testean
  sin levantar nada.
- `importer/` conoce Excel pero no la sesión.
- `movil/` junta los archivos con las cuentas y guarda el estado del mes.
- `routes/` es la única que habla HTTP.

Si mañana cambia la pantalla, la base o el login, las cuentas no se tocan.

## Hoy y cuando haya base de datos

| | Hoy | Con Postgres (plan, §11) |
|---|---|---|
| Cuántos móviles | uno solo en memoria, para todos | uno por mes |
| Si se reinicia el servidor | se pierde | queda guardado |
| Seguir mañana | solo si no se reinició | abrís el mes y está como lo dejaste |
| Mes siguiente | cargar archivos nuevos pisa los anteriores | móvil nuevo; las reglas se heredan |
| Retomar el trabajo de otro | hay un solo móvil, lo ven todos | el móvil es del mes, no de la persona: cualquiera con permiso lo sigue |
| Quién sos | siempre `planner-local` | tu usuario de Entra ID |
