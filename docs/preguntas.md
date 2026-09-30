# Preguntas abiertas

POC Distribución del Móvil · Nestlé DIL Región Plata · Universidad ORT

Solo lo que falta definir. Cuando una se responde, la respuesta pasa a
`entendimiento-negocio.md` (marcada [confirmado]) y se borra de acá. Los ids (A1,
R1…) se citan en el código: no se renumeran.

**Supuesto** = ya está implementado así, falta que lo confirmen.

---

## Para negocio

### Bloquean los MUST

| # | Pregunta | Qué hacemos hoy |
|---|---|---|
| B1 | **% manual por vendedor o distribuidor.** Cuando a uno se le asigna un % en vez del histórico: ¿es un % del total del canal, igual para todos los SKUs? ¿El mismo % para kilos y para pesos? ¿El resto se reparte por histórico entre los demás? | Nada: es el MUST que falta |
| B2 | **Vendedor o distribuidor nuevo.** ¿Se da de alta en la herramienta con un %, o siempre viene en el archivo? | Solo existen los que vienen en el archivo |
| B3 | **Aprobación.** ¿Alcanza con una aprobación final, o hay que dar el OK etapa por etapa (canal, después vendedores y distribuidores)? ¿Hay un umbral de desvío formal o alcanza con que cuadre? ¿Quién aprueba? | Se exporta con confirmación; no se registra aprobación |
| A1 | **Distribuidor apagado.** Su parte se reparte entre los demás "con el criterio que se defina". ¿Alcanza con proporcional al histórico de cada uno? | Supuesto: proporcional |
| B4 | **Base de cálculo.** En la reunión quedó "el reparto del mes anterior"; el documento funcional y el archivo de mayo usan el año 2025. ¿Con qué se arranca el primer mes, y después? | Supuesto: el mes anterior |

### Estructura

| # | Pregunta | Qué hacemos hoy |
|---|---|---|
| A10 | En Soluciones, ¿los vendedores cuelgan de Directa y de cada territorio (Córdoba, Rosario), y los distribuidores de Distribuidores? ¿Hace falta algún nivel más? | Supuesto: un nivel debajo de cada canal |
| B5 | **Clientes exclusivos o puntuales.** El documento habla de "cartera de clientes exclusivos" y de ventas puntuales a clientes nuevos, y el archivo tiene clientes con kilos propios. ¿Es un nivel más de apertura, un valor fijo o una regla? | Se fija la celda a mano |
| A5 | ¿La entidad es la persona o la persona más el sistema de origen (el mismo vendedor aparece con dos sufijos)? | Cada columna es una entidad |
| A14 | Un SKU que cae donde ningún vendedor o distribuidor lo vendió: ¿se reparte como el canal entero, se le asigna a alguien o se saca del canal? | Se avisa y queda sin abrir |
| A11 | Los SKUs que están en Ingredientes y en Soluciones: ¿se parten como cualquier otro? | Supuesto: los parte el cruce según los totales de cada canal |

### Datos de entrada y salida

| # | Pregunta | Qué hacemos hoy |
|---|---|---|
| A15 | **Excel de salida**: ¿qué hojas y columnas espera quien lo recibe? ¿Se vuelve a cargar en SAP? | Lo definimos nosotros: Kilos, Plata, Apertura, Problemas |
| B6 | **Formato de entrada**: ¿el mes viene en un solo archivo con bloques (como mayo) o en archivos separados? | Tres archivos separados |
| B7 | **NNS c/IIBB**: ¿se usa para algo o alcanza con NNS? | Se ignora |
| A2 | ¿Los totales por canal admiten margen (se mencionó ±500 kg) o cierran exacto? | Supuesto: exacto |
| A4 | SKU nuevo sin historia: ¿el planner dice en qué canales va y se reparte en proporción al total de cada uno? | Supuesto: así ("Dónde se vende") |
| A12 | Editar el mes anterior: ¿qué se edita, cuánto vendió un SKU en un canal o dónde se vende? | No se edita |

### Reglas

| # | Pregunta | Qué hacemos hoy |
|---|---|---|
| R1 | El % de una regla, ¿es siempre sobre el total del canal? | Supuesto: sí |
| R2 | Reglas debajo del canal ("ningún vendedor supera el 25%"): ¿van? ¿Sobre qué base? | No existen |
| R7 | Los 4 o 5 ejemplos reales de reglas que iban a mandar | Pendiente |

### Historial y usuarios

| # | Pregunta |
|---|---|
| A16 | ¿Un mes aprobado se puede reabrir? Si sí, se guardan versiones |
| A6 | ¿Los roles vienen de Entra o los administramos? ¿Todos los planners ven los meses anteriores? |

---

## Para IT

| # | Pregunta |
|---|---|
| I1 | Credenciales del índice privado (`nbra-*`) y del registry de npm. Sin esto el pipeline de Nestlé no instala |
| I2 | Acceso al sandbox y cómo se despliega |
| I3 | PostgreSQL: ¿lo proveen o lo desplegamos? ¿Hay un estándar para la capa de datos? |
| I4 | ¿Qué verifica el pipeline antes de mergear (cobertura, mutation testing)? ¿Quién aprueba los PRs? |
| I5 | ¿nose2 es obligatorio o podemos usar pytest? |
| I6 | App registration en Entra para el login |
| I7 | ¿TestSprite es obligatorio? (A9) |

---

## Pedidos pendientes

- **Archivos anonimizados.** El documento funcional dice que se comparten con
  vendedores A/B/C; el de mayo trae nombres reales de vendedores, distribuidores y
  clientes. No lo subimos a ningún lado.
- La sesión para ver armar el móvil en vivo.
- Un móvil ya terminado (con el reparto hecho), para comparar contra el nuestro.
