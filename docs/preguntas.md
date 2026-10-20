# Preguntas abiertas

POC Distribución del Móvil · Nestlé DIL Región Plata · Universidad ORT

Solo lo que falta definir. Cuando una se responde, la respuesta pasa a
`entendimiento-negocio.md` (marcada [confirmado]) y se borra de acá.

Decidido por nosotros (B8): el template propuesto no trae Categoría y no la pedimos;
la herramienta guarda la categoría de cada SKU y la hereda mes a mes.

Respondidas por el referente de negocio (07/10): base de cálculo (B4), apertura de
canales (A10, B5) y NNS c/IIBB (B7, no viene en el template). En la primera demo
(19/10): el % manual se compensa dentro del canal (B1, en lo principal), el alta de
vendedores desde la herramienta (B2) y el cierre exacto (A2). Ver
`entendimiento-negocio.md` §7, §10, §11 y §13. Los ids (A1, R1…) se citan en el
código: no se renumeran.

**Supuesto** = ya está implementado así, falta que lo confirmen.

---

## Para negocio

### Bloquean los MUST

| # | Pregunta | Qué hacemos hoy |
|---|---|---|
| B1 | **% manual: lo que queda abierto.** Confirmado (19/10) que el 100 % son las entidades del canal y que lo que se le saca a una se compensa entre las demás del mismo canal. Falta: ¿el mismo % para todos los SKUs y para kilos y pesos? | Supuesto: el mismo (M2) |
| B3 | **Aprobación.** ¿Alcanza con una aprobación final, o hay que dar el OK etapa por etapa? ¿Hay un umbral de desvío formal o alcanza con que cuadre? ¿Quién aprueba? | Supuesto: OK por etapa y aprobación final (M1, M4) |
| A1 | **Distribuidor apagado.** Su parte se reparte entre los demás "con el criterio que se defina". ¿Alcanza con proporcional al histórico de cada uno? | Supuesto: proporcional |

### Estructura

| # | Pregunta | Qué hacemos hoy |
|---|---|---|
| A5 | ¿La entidad es la persona o la persona más el sistema de origen (el mismo vendedor aparece con dos sufijos)? | Cada columna es una entidad |
| A14 | Un SKU que cae donde ningún vendedor o distribuidor lo vendió: ¿se reparte como el canal entero, se le asigna a alguien o se saca del canal? | Se avisa y queda sin abrir |
| A17 | En la demo (19/10) se habló de "primero canal, después territorio". En los totales por canal, Directa (BA), Córdoba y Rosario vienen como canales separados. ¿Es así, o Directa es un canal con tres territorios? Confirmarlo por escrito | Canales separados, como en el archivo |
| A11 | Los SKUs que están en Ingredientes y en Soluciones: ¿se parten como cualquier otro? | Supuesto: los parte el cruce según los totales de cada canal |

### Datos de entrada y salida

| # | Pregunta | Qué hacemos hoy |
|---|---|---|
| A15 | **Excel de salida.** Hay dos: el del equipo de ventas (por distribuidor, vendedor y canal; por SKU; kilos y plata, con y sin IIBB), que nos mandan con el de octubre, y el de Finanzas para la carga, que el referente pide a Finanzas. ¿La herramienta genera los dos? | Lo definimos nosotros: Kilos, Plata, Apertura, Problemas |
| B9 | **NNS c/IIBB en la salida.** El equipo de ventas recibe la plata con y sin Ingresos Brutos, pero el template de entrada no trae c/IIBB (B7). ¿De dónde sale: otra columna en el objetivo, o un % de IIBB? | No se genera |
| B6 | **Formato de entrada**: proponen un template estándar `SKU \| Descripción \| kg \| NNS / KG \| NNS` para el objetivo del mes. Lo están validando con Finanzas. | El objetivo se lee por nombre de columna: ese template se lee sin cambios |
| A4 | SKU nuevo sin historia: ¿el planner dice en qué canales va y se reparte en proporción al total de cada uno? | Supuesto: así ("Dónde se vende") |
| A12 | Editar el mes anterior: ¿qué se edita, cuánto vendió un SKU en un canal o dónde se vende? | No se edita |
| A18 | **Estacionalidad.** El café vende 2 a 3 veces más en invierno: el referente prefiere, a futuro, comparar contra el mismo mes del año anterior. Por ahora, el mes anterior (19/10). ¿Cuándo y para qué canales? | Mes anterior |

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
| I5 | ¿nose2 es obligatorio o podemos usar pytest? (Python es obligatorio, confirmado el 19/10) |
| I6 | App registration en Entra para el login. Confirmado (19/10): prefieren SSO con Entra; usuario y contraseña no (si fuera, mandan su política de contraseñas) |
| I7 | ¿TestSprite es obligatorio? (A9) |

---

## Pedidos pendientes

Acordado en la demo (19/10): **prueba con datos reales del móvil de noviembre**, entre
el fin de esa semana y el principio de la siguiente.

- **Ellos mandan**: el móvil de septiembre (base real) o el de octubre (cerrado), la
  hoja de Contraloría de noviembre y el template del equipo de ventas (A15).
- **Ellos piden a Finanzas**: el template de carga (A15).
- **IT**: acceso al repo para armar la imagen Docker y subirla a un servidor de ellos
  (I2). Alternativa: un entorno de prueba nuestro, en memoria.
- **Ellos prueban**: el referente de negocio y alguien de su equipo hacen el
  ejercicio completo y nos pasan comentarios.
- **Los archivos reales traen nombres de vendedores, distribuidores y clientes**: no
  entran al repo ni a ningún servicio externo. Se usan en local (`data/real/`, que git
  ignora) o en el servidor de ellos.
- La sesión para ver armar el móvil en vivo.
