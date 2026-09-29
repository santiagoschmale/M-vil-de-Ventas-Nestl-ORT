# Motor del móvil — notas

Estado, decisiones y gotchas del motor, la API y la pantalla. Lo lee el equipo y
Claude Code antes de tocar `domain/`, `importer/`, `movil/`, `routes/movil.py` o
`frontend/src/presentation/pages/Movil`.

## Cómo está armado

```
importer/entradas.py   objetivo (Excel), totales por canal (Excel o tabla), base y apertura del mes anterior
domain/cruce.py        cruce SKU × canal: filas = input 1, columnas = input 2
domain/flujo.py        flujo máximo y de costo mínimo (sin dependencias)
domain/reparto.py      largest remainder: repartir un total por pesos relativos
domain/arbol.py        debajo del canal: valor y estado, fijado, ON/OFF
movil/recorrido.py     encadena todo y exporta el Excel; también es la línea de comandos
movil/sesion.py        la sesión del mes: entradas, ON/OFF, celdas fijadas, historial
movil/repositorio.py   dónde vive la sesión (hoy en memoria, un lock global)
auth/proveedor.py      quién es el usuario (hoy "planner-local"; Entra ID después)
routes/movil.py        API /api/movil sobre la sesión
app.py                 crear_app(): elige repositorio y autenticación

frontend/src/stores/useMovil          store sobre /api/movil
frontend/src/presentation/pages/Movil pantalla central (ruta /)
```

El dominio no importa FastAPI, ni la base, ni openpyxl. Se testea sin levantar nada.
La sesión recalcula el recorrido entero con cada cambio y cada cambio es una
transacción: si el recálculo falla, vuelve al estado anterior.

## Correrlo

Desde la raíz del repo (`make` solo muestra la ayuda):

```
make instalar   # una vez: entorno de Python y dependencias del front
make dev        # API en :3000 y pantalla en http://localhost:5175
make test       # tests del backend y del front
```

`make api` y `make web` levantan cada parte por separado. Sin pantalla, el recorrido
entero también corre por línea de comandos:

```
cd backend && .venv/bin/python -m src.movil.recorrido \
    --input1 ../data/sample/input1_objetivo.xlsx \
    --input2 ../data/sample/input2_canales.tsv \
    --base ../data/sample/base_mes_anterior.xlsx \
    --salida movil.xlsx
```

Con la muestra tal cual frena en el SKU nuevo sin base (A4), a propósito. Para ver
un móvil que cierra, apagar ese SKU y usar el input 2 sin él:

```
.venv/bin/python -m src.movil.recorrido \
    --input1 ../data/sample/input1_objetivo.xlsx \
    --input2 ../data/sample/input2_sin_sku_nuevo.tsv \
    --base ../data/sample/base_mes_anterior.xlsx \
    --apagar 90020900 --salida movil.xlsx
```

### La pantalla

En la pantalla, "Cargar datos de muestra" carga las tres entradas. La sesión vive en
memoria: reiniciar el backend la pierde. Desde Claude Code: `template-api` y
`template-web` en `.claude/launch.json` del workspace.

Los datos de prueba se regeneran con `data/sample/generar_muestra.py`: semilla,
fechas y horas internas del zip fijas, así que regenerar da los mismos bytes.

## El cruce SKU × canal

1. **Chequeos directos**, todos juntos: los dos inputs suman lo mismo, cada SKU se
   vendió en algún canal, cada canal tuvo algún SKU. Si todo lo de un SKU o un
   canal está fijado, el mensaje lo dice.
2. **Factibilidad por flujo máximo.** Si no hay reparto posible, el corte mínimo
   dice qué canales piden más de lo que pueden darles los SKUs que se venden ahí
   (condición de Hall), separado en grupos que no comparten SKUs.
3. **Celdas que en toda solución quedan en 0** (con base, pero sin lugar): se sacan
   y se avisan. Sin esto el ajuste converge muy lento.
4. **Ajuste biproporcional (RAS / IPF)** desde la base, en Decimal con 50 dígitos.
   Corta si se estanca.
5. **Redondeo controlado**: cada celda al piso o al techo, elegido por flujo de
   costo mínimo para que filas y columnas cierren exacto, prefiriendo las de mayor
   resto (largest remainder en dos dimensiones).

Kilos y plata se cruzan por separado, con la misma base: el ajuste escala filas y
columnas, así que el precio distinto de cada canal lo absorbe solo.

## Debajo del canal

Cada celda del cruce con apertura del mes anterior es la raíz de un árbol: el
valor se reparte entre distribuidores o vendedores con `arbol.recalcular`. Las
entidades apagadas salen en todas las celdas y su parte va a las demás de la misma
celda. El cruce no cambia al apagar un distribuidor.

## Supuestos (a confirmar con el cliente)

- **A4 · SKU sin historia**: el planner elige dónde se vende ("Dónde se vende") y se
  reparte en proporción al total de cada canal elegido; debajo del canal, como se abrió
  el canal entero el mes anterior. `movil/recorrido.py::_donde_se_vende`.

- **A1**: al apagar una entidad, su parte se reparte proporcional al histórico.
- **A2**: el input 2 cierra exacto. Si admite margen (±500 kg), es un parámetro
  nuevo del cruce: las columnas pasan a ser rangos.
- **A3**: formato de la apertura (hoy formato largo en una hoja de la base).
- **A14**: una celda que cae donde ningún vendedor o distribuidor vendió ese SKU el mes
  anterior no se abre: se avisa (amarillo) y queda en el canal. No se inventa.
- **A10**: los vendedores cuelgan de Directa y de cada territorio.
- **A11** (2 SKUs en los dos segmentos): **lo resuelve el cruce**. Es una fila con
  base en canales de los dos segmentos; el ajuste la parte según los totales de
  cada canal. No hace falta una regla aparte.
- Una celda con base 0 ("aplica con cero") recibe 0: el ajuste biproporcional no
  hace crecer un cero. Si el planner quiere darle algo, la fija.

## Gotchas

- **`Decimal("10") == Decimal("10.000")` es verdadero.** Comparar valores no
  alcanza para saber si un monto salió con los decimales de su unidad: los tests
  miran también el exponente.
- **El orden de carga no puede cambiar el resultado.** El cruce ordena filas,
  columnas y base antes de todo; con restos empatados el desempate del flujo
  dependía del orden de inserción.
- **Excel guarda floats.** Se convierten con `Decimal(repr(x))` en un solo lugar
  (`_celda`). Es el único punto donde entra un float.
- **Números pegados**: formato argentino si tiene forma de miles con punto
  (13.000, 1.234,56); si no, punto decimal. "1.234" se lee mil doscientos treinta
  y cuatro. Acepta `$` adelante; un espacio en el medio no se adivina.
- **Input 2 separado por comas con coma decimal** parte las celdas: la fila con
  más columnas que el encabezado se rechaza, no se lee a medias.
- **Códigos de SKU**: solo dígitos se normalizan (`00123` = `123`). Canales: se
  cruzan sin importar tildes, mayúsculas ni espacios.
- **Los montos viajan como texto** (`"1234.500"`) con los decimales de su unidad.
  El front solo cambia separadores (`formatear`), nunca los convierte a número:
  un número JSON pasa por float en JavaScript.
- **Mensajes al planner con montos en formato argentino** (`a_texto`: 10,000 kg,
  no 10.000) y diciendo qué hacer. Nada de códigos internos (A4) ni del reparto
  ("pesos son cero") en lo que se muestra.
- **"Plata" en la API, "Pesos" en pantalla**: el cliente dice plata; en pantalla se
  usa la unidad, que se lee igual en cualquier lado. Se cambia en `UNIDADES` de
  `formato.ts`.
- **Nombres con `/` en la URL**: canales y entidades van al final de la ruta con
  `:path`, porque Starlette decodifica `%2F` antes de rutear.
- **Todo ajuste pide motivo** (fijar, desfijar, ON/OFF). Las cargas de entradas van
  al historial sin motivo.
- **Celdas fijadas de un SKU apagado** quedan en espera y vuelven al prenderlo; no
  rompen la sesión.
- **MSW en desarrollo**: el front arranca con el worker de msw; lo que no tiene
  mock (todo `/api/movil`) pasa al backend. Si el navegador tiene un worker viejo
  registrado, se traga pedidos: desregistrarlo y recargar.
- **Reglas muy justas**: el ajuste con reglas converge lento cerca del borde. Si no
  llega, el reparto cierra y cumple las reglas igual pero se aleja de la base, y se
  avisa (`_REGLAS_JUSTAS`). En los casos de prueba armados al límite pasa ~3%.
- **Tests del front y RAM**: `vitest.config.ts` (no `vite.config.ts`, que no manda
  para los tests) limita a 2 workers; con uno por núcleo el pico pasaba 2 GB.
- **Rojo o amarillo**: rojo es solo lo que no cierra (las inconsistencias del cruce) y
  bloquea exportar. Todo problema del archivo o de la apertura es amarillo: no bloquea,
  y al exportar se muestra y se pide confirmar.
- **La API se reinicia sola en local** (`reload` en `app.py` con IS_LOCAL): cada cambio al
  código del backend borra la sesión en memoria. Hay que volver a cargar la muestra.
- **Otro programa en el puerto 3000**: vite reenvía a `127.0.0.1:3000`, no a
  `localhost` (que puede resolver a `::1` y caer en otra app). Si igual contesta HTML,
  la pantalla dice "contestó otra aplicación".
- **Subir archivos en los tests del front**: jsdom + axios + msw se cuelgan con un
  `FormData`. Los tests de la pantalla prueban que se llama a la acción; el pedido
  HTTP lo cubre el test de la API.
- **Librerías `nbra-*`**: no existen en los registros públicos y no hay que
  pedirlas ahí (dependency confusion). `make deps-local` usa `local_shims/`.

## Falta

- Margen del input 2 (A2).
- Reglas: hoy tope, mínimo y fijo en % del total del canal por categorías (cruce,
  sesión, API y panel). Faltan las de vendedor dentro de un canal (apertura), la
  herencia del mes anterior (necesita persistencia) y lo abierto en
  `docs/entendimiento-negocio.md` §9.
- Aprobación del móvil por una persona ("Aprobar y exportar"; hoy se exporta con
  confirmación si quedan cosas para revisar, sin registrar la aprobación).
- Editar el mes anterior en la plataforma (A12). Resolvería también A14.
- Guardar las cargas sin perderlas: con la recarga automática, cada cambio al código del
  backend reinicia la sesión (ver Persistencia).
- Persistencia en Postgres (otra implementación de `repositorio.py`).
- Entra ID (otro proveedor en `auth/proveedor.py`).
- Buscador de SKUs en la matriz, si la cantidad real lo pide.
