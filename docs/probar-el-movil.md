# Probar el Móvil de Ventas

Paso a paso para armar el móvil de un mes, de punta a punta. Los nombres que
aparecen entre comillas son los que vas a ver en la pantalla.

Si en algún momento no sabés qué sigue, mirá la barra de abajo: siempre dice
**"Siguiente: …"** con el paso que falta.

---

## 1. Entrar

1. Abrí el link de la herramienta.
2. Escribí tu mail.
3. Te llega un código por mail. Copialo y pegalo.

---

## 2. Cargar las entradas

Se abre la sección **"Entradas"**, con tres tarjetas. Cargalas **en este orden**,
de izquierda a derecha: cada una necesita la anterior.

### 2.1 Objetivo de Contraloría

Es la meta del mes: cuántos kilos y cuántos pesos hay que vender de cada SKU.

- Tocá **"Subir Excel"**.
- Elegí el `.xlsb` del móvil (usa la hoja *Móvil Mes*), o un Excel con las
  columnas `SKU | Descripción | kg | NNS / KG | NNS`.
- Cuando carga, la tarjeta muestra el nombre del archivo, cuántos SKUs trae y
  los totales.

### 2.2 Mes anterior

Es de dónde sale el histórico: cómo se repartió el mes pasado.

- Tocá **"Subir Excel"** y elegí **el mismo `.xlsb`**.
- La tarjeta muestra cuántas celdas y cuántas aperturas trae.

### 2.3 Totales por canal

Es cuánto le toca a cada canal. Tenés dos caminos:

- **"Armar en pantalla"** (lo habitual): se abre un diálogo ya precargado con
  los canales del mes anterior. Editás los kilos y los pesos de cada uno.
  Este botón se habilita recién cuando cargaste el mes anterior, porque de ahí
  salen los canales.
- **"Subir Excel"**: si tenés los totales en un archivo aparte.

Mientras editás, el diálogo te va diciendo cuánto falta para llegar a lo que
pide Contraloría, y tenés botones para ajustarlo en un clic.

---

## 3. Resolver lo que no cierra

Abrí la sección **"Para revisar"**. Hay dos grupos:

- **"Frenan"** (en rojo): hay que resolverlos para poder aprobar.
- **"Avisos"** (en ámbar): no frenan, pero conviene mirarlos.

Cada alerta trae el botón que la resuelve. Los más comunes:

| Alerta | Qué hacer |
|---|---|
| No coincide con Contraloría | **"Corregir en Totales por canal"** |
| Los SKUs no alcanzan / Canal sin historia | **"Editar totales por canal"** |
| SKU sin historia | **"Elegir canales"**: decile en qué canales se vende |
| Pesos no cierra | **"Recalcular según los kilos"** |

El botón **"Ir a…"** te lleva a la fila o a la regla de la que habla la alerta.

> Los kilos y los pesos se revisan por separado. Arriba de la tabla hay un
> selector **Kilos / Pesos**: cambialo para ver y resolver cada uno.

---

## 4. Mirar y ajustar la tabla

La sección **"SKU × canal"** muestra el reparto: una fila por SKU, una columna
por canal.

- Tocá cualquier celda para abrirla. Podés **fijar** un valor a mano: escribís
  el número nuevo y **el motivo** (el motivo es obligatorio).
- Lo que fijás queda quieto: el resto se reacomoda alrededor para que el total
  siga cerrando.
- Si te arrepentís, **"Deshacer"** vuelve atrás el último cambio.

---

## 5. Revisar por etapa

Arriba de la tabla está **"Revisión por etapa"**, con dos pasos en orden:

1. **Por canal**: mirá la tabla SKU × canal y, si está bien, tocá
   **"Marcar revisada"**.
2. **Debajo del canal**: tocá una celda de un canal que se abre (Distribuidores,
   Directa, Córdoba, Rosario) para ver cómo se reparte entre distribuidores o
   vendedores. Si está bien, **"Marcar revisada"**.

La etapa 2 se habilita recién cuando marcaste la 1, y las dos se habilitan
recién cuando kilos y pesos cierran.

---

## 6. Aprobar

Con todo cerrado y las dos etapas revisadas, se habilita **"Aprobar"**, abajo a
la derecha. Te pide confirmar.

Después de aprobar, el móvil no se puede cambiar: si hace falta, hay un botón
**"Reabrir"** que pide un motivo.

---

## 7. Exportar

**"Exportar"** baja el Excel con el móvil armado.

Si quedaron cosas para revisar, te avisa cuáles antes de bajarlo y te deja
decidir si seguís igual.

---

## Dos cosas que conviene saber

- **Todo cambio queda registrado.** En la sección **"Historial"** está qué se
  cambió, quién y por qué.
- **El sistema propone, vos decidís.** Nada se aprueba solo: el último paso
  siempre lo da una persona.
