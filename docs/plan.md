# Plan de trabajo — POC Distribución del Móvil

Nestlé DIL Región Plata · Universidad ORT · septiembre a noviembre 2026

Documento vivo: **qué se hizo, qué falta y en qué orden**. El dominio está en
`entendimiento-negocio.md`, lo que falta definir en `preguntas.md` y lo técnico en
`backend/src/domain/NOTES.md`. Se actualiza en el mismo PR que cambia el estado.

Fuentes: documento funcional v1.0 del cliente (26/08/2026, prioridades MoSCoW de su
§10), reunión inicial, reunión de reglas y archivo de mayo.

Estado: ✅ hecho · 🟡 en parte · ⬜ pendiente. Todo lo hecho está en la rama
`feat/template-nestle`.

---

## 1. Dónde estamos (29/09)

El recorrido completo funciona sobre datos de prueba:

- carga de las tres entradas;
- reparto SKU × canal con reglas;
- apertura debajo del canal;
- ON/OFF;
- ajuste a mano con historial;
- exportación a Excel.

Todo vive en memoria y hay un solo móvil.

De los MUST del cliente faltan dos cosas grandes:

- la **base de cálculo con % manual por entidad**;
- la **aprobación**.

La persistencia no figura en los MUST del cliente, pero la aprobación y el
histórico la necesitan para tener sentido.

---

## 2. Backlog

### MUST

| Funcionalidad | Estado | Qué falta |
|---|---|---|
| Distribución en cascada con recálculo | ✅ | Cruce SKU × canal y apertura debajo del canal; cada cambio recalcula todo. Confirmar que un nivel debajo del canal alcanza (A10) |
| Excepciones ON/OFF de SKUs, vendedores y distribuidores | ✅ | Criterio al apagar: proporcional como supuesto (A1) |
| Ajuste manual con valor fijado y motivo | ✅ | — |
| Base de cálculo histórico / % manual por entidad | ⬜ | **M2** |
| Alta de vendedor o distribuidor nuevo | ⬜ | **M3**, depende de B2 |
| Aprobación del móvil | ⬜ | **M1** |
| Revisión por etapa | 🟡 | Cada etapa se ve (matriz, apertura por celda), pero no se aprueba por separado. **M4**, depende de B3 |
| Exportación a Excel | ✅ | Formato de salida a confirmar (A15) |
| Trazabilidad (quién, qué, cuándo, por qué) | ✅ | En memoria; se pierde al reiniciar |

### Necesario para los MUST (no figura en el MoSCoW)

| Funcionalidad | Estado | Qué falta |
|---|---|---|
| Persistencia en Postgres, un móvil por mes | ⬜ | §6. Otra implementación de `repositorio.py` |
| Autenticación | 🟡 | Proveedor local detrás de una interfaz. Entra depende de IT (I6) |
| Entorno de pruebas para el cliente | ⬜ | Depende de IT (I1, I2) |
| Tests en CI | ✅ | Backend y front |
| Deshacer el último cambio | ✅ | Una vez. Con login: solo el propio |

### SHOULD

| Funcionalidad | Estado |
|---|---|
| Reglas por back office: tope, mínimo y fijo en % por categorías, "Dónde se vende" | 🟡 Faltan las reglas debajo del canal (R2), las estacionales y la herencia del mes anterior (necesita persistencia) |
| Histórico con realimentación: el aprobado es la base del mes siguiente; importar 2025 | ⬜ Depende de la persistencia y de B4 |
| Simulación de escenarios | ⬜ |
| Cuadratura automática de totales | ✅ |

### COULD

Dashboard vendedor × kilos y facturación · template de carga para SAP (A15) · cargas
masivas · multi-país y multi-negocio. Nada empezado.

### Fuera de la POC

Reemplazar la validación humana, carga automática o en tiempo real a SAP, seguimiento
durante el mes, versión mobile, IA.

---

## 3. Plan de los MUST

En este orden. Cada uno con tests primero y verificación en la pantalla.

### M1 · Aprobación del móvil

No depende de preguntas abiertas, salvo el detalle de A16 y B3.

- **Botón "Aprobar"**. Pide que kilos y pesos cierren y que no haya nada en rojo. Si
  queda algo en amarillo, se muestra y se pide confirmar, igual que al exportar.
- **Aprobado es solo lectura**: la sesión rechaza cualquier ajuste y deshacer queda
  deshabilitado.
- **Queda en el historial**: quién aprobó y cuándo. El estado se ve en el
  encabezado.
- **"Reabrir" con motivo**, como supuesto (A16): vuelve a borrador y queda en el
  historial.
- **Sin base de datos**: la aprobación vive en la sesión en memoria; cuando llegue
  Postgres, se guarda con el móvil del mes.

Hecho cuando se puede aprobar un móvil que cierra, no se lo puede tocar aprobado, se
puede reabrir con motivo y todo queda en el historial.

### M2 · Base de cálculo: histórico o % manual por entidad

Depende de B1. Se puede construir con un supuesto y mostrarlo el viernes, como se
hizo con A4.

- **Qué es**: en un canal que se abre, a un vendedor o distribuidor se le puede
  asignar un % en vez de su histórico. Caso típico: le cambiaron la cartera.
- **Supuesto (B1)**:
  - el % es del total del canal y vale para cada SKU de ese canal, en kilos y en
    pesos;
  - lo que queda (100 − la suma de los %) se reparte entre los demás por
    histórico.
- **Cómo cierra exacto**: en cada celda, primero se reparte el total entre los que
  tienen % y el grupo de los que van por histórico, con mayores restos. Después la
  parte del grupo se reparte por histórico. Lo fijado a mano sigue mandando.
- **Validaciones**:
  - los % de un canal no pasan de 100;
  - si todos los prendidos tienen %, tienen que sumar 100;
  - un apagado no recibe nada aunque tenga %.
- **Dónde toca**:
  - `domain/apertura.py`: el reparto entre hijos;
  - `movil/sesion.py`: la operación y el historial;
  - la API;
  - la apertura en la pantalla: elegir histórico o % por entidad.

Hecho cuando a un vendedor se le pone 30% en Córdoba, recibe el 30% de cada celda de
Córdoba, el resto se reparte por histórico y todo cuadra.

### M3 · Alta de vendedor o distribuidor nuevo

Depende de B2 y se apoya en M2.

- **Se agrega a un canal** con nombre y un %. No tiene historia, así que sin % no
  recibe nada.
- **Queda en el historial** y se puede apagar como cualquier otro.

### M4 · Revisión por etapa

Depende de B3. Si alcanza con la aprobación final (M1), se descarta.

- **Marcar cada etapa como revisada**: primero el canal, después la apertura.
- **Un cambio en una etapa** desmarca las siguientes, porque las recalcula.
- **Aprobar exige** todas las etapas revisadas.

### Después de los MUST

1. Persistencia (§6), que habilita la herencia de reglas y el histórico.
2. El formato real de entrada y salida, según B6 y A15.
3. Los SHOULD.

---

## 4. Cómo lo encaramos

- **De a un MUST, en secuencia y en esta rama.** M1, M2 y M3 tocan los mismos
  archivos (`sesion.py`, `apertura.py`, `routes/movil.py`, `Movil.tsx`). En paralelo,
  en worktrees separados, chocarían al mergear, y cada worktree necesita su propio
  entorno de Python y `node_modules` y corre sus tests: no entra en la RAM de una
  máquina que ya tiene otros trabajos corriendo.
- **Agentes solo para lo que no escribe código**: la revisión de código al cerrar
  cada MUST, o buscar algo en muchos archivos.
- **Tests**: los del archivo que se toca. La suite completa, antes de subir.
- **Cada MUST cierra** con su estado actualizado en este documento, en el mismo
  commit.

---

## 5. Decisiones

### Cerradas por el cliente

| Tema | Definición |
|---|---|
| Stack | Python + FastAPI, PostgreSQL, React. Monorepo de Backstage, deploy con ArgoCD |
| Autenticación | Microsoft Entra ID, sujeto a IT |
| Alcance | Professional Argentina. SAP es nice to have |
| Escala | ~20 planners concurrentes, web desktop, ciclo mensual |
| Entorno de pruebas | El cliente quiere probar por su cuenta, no ver demos: al grupo anterior las demos le andaban y el producto no. Cada merge despliega al sandbox, así que no se mergea sin verificar |

El dominio confirmado (inputs, cruce, estructura, reglas) está en
`entendimiento-negocio.md`.

### Técnicas propias

- **Decimal, nunca float.** Los montos viajan como texto; el front no calcula.
- **Cuadratura exacta**: mayores restos debajo del canal y redondeo controlado en el
  cruce (filas y columnas a la vez).
- **Cruce SKU × canal por ajuste biproporcional (RAS / IPF)** desde la base, con
  reglas como restricciones y conflictos informados, no resueltos en silencio.
- **Pesos relativos**, no porcentajes que sumen 1. Apagar una entidad es sacarla del
  reparto.
- **Árbol de profundidad variable**: cada canal se abre hasta donde diga el archivo.
- **Canales, entidades y reglas son datos**, nunca código.
- **"No aplica" ≠ "aplica con cero".**
- **Cada nodo tiene valor y estado** (calculado / fijado). Lo fijado no se pisa.
- **Cada cambio es una transacción**: si el recálculo falla, vuelve atrás. Se
  recalcula el mes entero.
- **El dominio no conoce FastAPI, ni la base, ni Excel.**
- **Autenticación y almacenamiento detrás de una interfaz** (`auth/proveedor.py`,
  `movil/repositorio.py`): Entra y Postgres se enchufan sin tocar el resto.
- **Nada de datos reales en el repo.** La muestra es inventada y replica la forma
  real.
- **E1**: el repo del equipo tenía la API en Express + Prisma (`main`). Esta rama la
  reemplaza por Python; falta que el equipo decida el merge a `main`.

---

## 6. Propuesta: historial y un móvil por mes

Estado: propuesta. Depende de la persistencia y de A6, A15 y A16.

- **Un móvil por mes**, compartido por todos los planners. El historial es del móvil
  y cada entrada dice quién la hizo: "lo que hizo Juan" es un filtro, no otra
  sesión.
- **Retomar**: cerrás hoy y mañana abrís el móvil del mes tal como quedó. Si alguien
  está de vacaciones, otro planner lo sigue desde su cuenta.
- **Borrador → aprobado.** Aprobado es solo lectura. Si se puede reabrir (A16), cada
  reapertura es una versión.
- **Meses anteriores**: se abren en solo lectura. En cada celda se ve su historia y el
  historial se filtra por persona, SKU o canal.
- **El mes siguiente** es un móvil nuevo que hereda las reglas. No hace falta
  "limpiar la sesión".
- **El Excel no es la fuente del historial**: no se le agregan hojas hasta saber el
  formato de salida (A15). El Excel de entrada no se modifica nunca.
- **Modelo mínimo**: `Movil(mes, estado, versión)`, sus entradas y reglas, y
  `Ajuste(movil, acción, detalle, autor, cuándo, motivo)`, que es lo que hoy guarda
  `Sesion.historial`. Al hacerlo, renombrar `Sesion` a *móvil del mes*.

---

## 7. Dependencias externas

| Dependencia | Riesgo si llega tarde |
|---|---|
| Respuestas del viernes (B1 a B4, A10) | **Alto.** Definen M2, M3 y M4 |
| Credenciales del índice privado (`nbra-*`, npm) | **Alto.** El pipeline de Nestlé no instala |
| Acceso al sandbox | **Alto.** Es el entorno donde prueba el cliente |
| PostgreSQL: ¿lo proveen o lo desplegamos? | Medio. En local se usa un contenedor |
| App registration en Entra | Medio. Mitigado con el proveedor local |
| Archivos anonimizados | Bajo técnicamente, alto en cumplimiento |
| Sesión para ver armar el móvil en vivo | Medio. Las reglas no están documentadas |

---

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| Se construye M2 sobre un supuesto que el cliente cambia | Mostrarlo funcionando el viernes; el reparto está aislado en `apertura.py` |
| El formato real de entrada o de salida es distinto del nuestro | Preguntarlo (B6, A15). La lectura está aislada en `importer/` |
| Una salida mal armada se carga en SAP (ya pasó: aperturas invertidas con totales correctos) | Cuadratura en cada nivel, no solo en el total. No cambiar el formato sin confirmarlo |
| Datos reales en el repo | Solo muestra inventada. El archivo de mayo no se sube |
| Algo que se ve bien en la demo y falla en uso | Entorno de pruebas abierto al cliente y tests en CI |
| Reglas reales fuera del catálogo | Validar con los ejemplos (R7) |

---

## 9. Calendario

- **Septiembre, definición**: ✅ recorrido end-to-end sobre datos de prueba y dominio
  consolidado.
- **Octubre, construcción**: los MUST (§3), la persistencia y el entorno de pruebas.
- **Noviembre, validación y entrega**: datos reales de varios meses, validación con el
  planner, documentación y defensa. La última semana, entera para documentación y
  ensayo.
