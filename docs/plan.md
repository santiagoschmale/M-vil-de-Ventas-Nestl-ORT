# Plan de trabajo — POC Distribución del Móvil

Nestlé DIL Región Plata · Universidad ORT · septiembre a noviembre 2026
Documento vivo. Última actualización: después de la reunión con la referente de negocio saliente y su transcripción.

---

## 0. Estado de las decisiones

### Cerrado por el cliente

| Tema | Definición |
|---|---|
| Stack backend | Python + FastAPI |
| Base de datos | PostgreSQL |
| Autenticación | Microsoft Entra ID (SSO), sujeto a la factibilidad que informe IT |
| Frontend | React |
| Repositorio | GitHub Enterprise, cuentas @ort |
| Scaffold | Monorepo generado por Backstage |
| Deploy | ArgoCD. Cada merge dispara el pipeline, que lo declara Nestlé. Hay entorno sandbox |
| **Qué resuelve** | La herramienta hace el primer reparto sola a partir de los lineamientos del planner. El planner corrige solo lo que no cierra |
| **Flujo** | Input 1 + input 2 + reglas → reparto automático → inconsistencias → ajuste humano → Excel |
| **Reglas** | Matemáticas, definidas por el negocio. Combinan dónde aplican, sobre qué variable (kilos o plata) y qué límite. Se heredan del mes anterior |
| **Tipos de regla** | Total por canal · dónde se vende un SKU · tope o mínimo en % · valor fijo en kilos |
| **Rol del planner** | Supervisión: define reglas, revisa el resultado, corrige lo puntual |
| **Excepciones ON/OFF** | Prender o apagar SKUs, vendedores o distribuidores antes del reparto. MUST |
| **Profundidad de apertura** | Variable. Catering, Vending, Mayoristas y KAM Ingredientes cierran a nivel canal. Soluciones se abre en Distribuidores, Directa (BA), Córdoba, Rosario y KAM Sol, y baja más |
| **Territorios** | Existen: Buenos Aires, Córdoba, Rosario. En el input 2 figuran como canales |
| **Cambios de entidades** | Vendedores y distribuidores cambian poco; los productos entran y salen |
| **Base SKU-canal** | No todos los SKUs se venden por todos los canales |
| **Input 1** | De Contraloría: SKU, kilos, plata. Esenciales: SKU y kilos |
| **Input 2** | Del planner: canal, kilos, plata. Tabla pegada cada mes, precargada con la del mes anterior |
| **Base de partida** | La distribución del mes anterior, editable |
| **Plata** | Es input por canal: cada canal tiene su precio. No se valoriza |
| **SKUs en cero** | Son obsoletos o estacionales |
| **Desvíos en los controles** | No deberían existir. Son errores, no lógica a replicar |
| **Histórico** | Guardar cómo quedó abierto el reparto y la interacción humana |
| Alcance SAP | Nice to have. Fuera del MUST |
| Alcance negocio | Professional Argentina |
| Escala | ~20 usuarios concurrentes, web desktop |
| Periodicidad | Mensual |
| Seguimiento de avance | Externo (SAP + dashboards de Nestlé) |
| **Entorno de pruebas** | **Requisito: ambiente accesible para que el cliente pruebe por su cuenta** |
| IA / ML | Fuera de alcance |

### Inferido por nosotros (no lo dijo el cliente)

- **Dos segmentos.** Ingredientes es producto usado como insumo (puré, leche en polvo, cacao, café soluble). Soluciones es café servido (Nescafé Alegría, vasos, tapas, vajilla, azúcar en stick).
- **El cálculo central es un cruce SKU × canal**: filas que suman el input 1, columnas que suman el input 2, celdas en cero donde el SKU no se vende. Se resuelve con ajuste biproporcional (RAS / IPF) partiendo del reparto del mes anterior.
- **Los distribuidores son hojas.** Los vendedores cuelgan de la venta directa y los territorios: la proporción directa contra distribuidores en el input 2 (78 / 22) coincide con Call Center contra Distribuidores en el histórico (77 / 23).
- La hoja de participaciones tiene cuatro bloques con estructura distinta. Los bloques 2, 3 y 4 son los mismos 38 SKUs; el bloque 4 ya viene como fracciones que suman 1.
- 108 SKUs de los cuales 45 con objetivo; 12 SKUs son el 80% del volumen.
- 15 columnas de vendedor corresponden a 12 personas (sufijo distinto según sistema de origen).
- El precio implícito por kilo varía entre 3% y 29% contra el histórico, consistente con precios propios por canal.
- Hay SKUs de UY, BR, CL y PE en un archivo que se presenta como de Argentina.
- El archivo de mayo ya viene con la distribución hecha: la hoja de participaciones es trabajo del planner.
- Los porcentajes redondeados del input 2 de ejemplo suman 101%.

### Abierto

**Reparto y datos**

| # | Pregunta | Prioridad |
|---|---|---|
| A1 | **Criterio de re-normalización**: cuando se modifica un SKU o se deshabilita una entidad, ¿cómo se reparte la diferencia? ¿Proporcional o en partes iguales? | Alta, es MUST |
| A2 | **Margen en los totales por canal**: ¿el input 2 admite margen (se mencionó ±500 kg) o cierra exacto como el input 1? | Alta |
| A3 | Formato exacto del input 2 para pegar en la herramienta | Media |
| A4 | SKU sin reparto previo (nuevo, no estaba el mes anterior): ¿cómo se abre? | Media |
| A5 | ¿La entidad vendedor es la persona o el par persona-sistema? | Media |
| A6 | ¿Los roles vienen de grupos de Entra o los administramos nosotros? | Media |
| A8 | ¿Un canal que hoy cierra a nivel canal podría abrirse por vendedor más adelante? | Baja (la arquitectura ya lo cubre) |
| A9 | ¿TestSprite es obligatorio o sugerido? | Baja |
| A10 | Ubicación de territorios y vendedores dentro de Soluciones (hipótesis: bajo la vía Directa) | Alta |
| A11 | 2 SKUs aparecen en Ingredientes y en Soluciones: ¿cómo se parte su objetivo entre segmentos? | Media |
| A13 | Siglas y nombres propios del archivo: KAS y otros dos (ver notas internas) | Baja |

**Reglas**

| # | Pregunta | Prioridad |
|---|---|---|
| R1 | **Base del porcentaje**: "25% por vendedor en Córdoba" ¿de qué total? | Alta |
| R2 | En qué nivel del árbol actúa cada tipo de regla | Alta |
| R3 | Tope compartido ("Córdoba y Buenos Aires no supera 15%"): ¿cada uno o la suma? | Alta |
| R4 | Si una regla no se puede cumplir: ¿el sistema recorta y redistribuye, o avisa? | Alta |
| R5 | Prioridad entre reglas que se contradicen | Media |
| R6 | ¿Una regla puede aplicar sobre kilos y precio a la vez? | Media |
| R7 | Validar el catálogo de tipos con los 4 o 5 ejemplos reales que envía el cliente | Alta |

**Del equipo**

| # | Tema | Prioridad |
|---|---|---|
| E1 | El repo del equipo tiene la API en Express + Prisma. Alinearlo con el stack confirmado: motor, reglas e importador en Python | Alta |

---

## 1. Dependencias externas

| Dependencia | Estado | Riesgo si llega tarde |
|---|---|---|
| **Nuevo referente de negocio** | La owner dejó la organización. Nestlé tiene que designar reemplazo | **Alto.** Sin referente no se validan las reglas reales |
| **Sesión de observación** con quien arma el móvil hoy | Pendiente, depende del nuevo referente | **Alto.** Las reglas no están documentadas |
| **Ejemplos de reglas de negocio** | Comprometidos 4 o 5 ejemplos reales. Hay un input 2 de ejemplo | Alto. Validan el catálogo de tipos |
| **Distribuciones mensuales del último año** | Pedidas. El planner las tiene | Medio. Base de partida y datos de prueba |
| **Excel de Contraloría sin distribuir** | Pedido | Medio. Es el formato real del input 1 |
| **App registration en Entra** (client ID, tenant ID, redirect URIs) | Consultada la factibilidad y el plazo a IT | Medio. Mitigable con proveedor local |
| **Credenciales del índice privado** para las librerías `nbra-*` y el registry de npm | No solicitado | **Alto.** Sin esto no se puede ni instalar dependencias |
| **Acceso al entorno sandbox** | Existe, falta acceso | Alto a partir de octubre |
| **Instancia de PostgreSQL** en el sandbox | Consultado si la proveen o la desplegamos | Medio |
| **Archivo anonimizado** | Solicitado | Bajo técnicamente, alto en cumplimiento |
| **Documentación de la referente saliente** | Prometida | Medio |

---

## 2. Preguntas técnicas sobre el scaffold

Salen de revisar el template que mandó IT. Consolidadas con el resto en el documento de preguntas pendientes.

1. **¿De dónde se instalan las librerías `nbra-*` y el registry de npm?** ¿Hacen falta credenciales o VPN?
2. **El scaffold no trae capa de persistencia.** No hay modelos, ni migraciones, ni SQLAlchemy. ¿Hay un estándar de Nestlé, o lo definimos nosotros?
3. **¿El pipeline exige umbrales** de cobertura o de mutation testing para poder mergear?
4. **¿nose2 es obligatorio o podemos usar pytest?**
5. **¿Quién figura en CODEOWNERS?** ¿Nuestros PRs los aprueba alguien de Nestlé?

---

## 3. Septiembre — Definición

Objetivo: tener el recorrido end-to-end feo pero funcional sobre datos de prueba, y el entendimiento del negocio consolidado.

**Motor de reparto.** Módulo Python puro con largest remainder y cuadratura exacta. Tests escritos y verificados; implementación en curso.

**Árbol de profundidad variable.** Debajo del canal, nodos con valor y estado, base SKU-canal.

**Importador del input 1.** Cruce por código de SKU, detección de columnas por nombre, reporte de problemas de calidad.

**Carga del input 2.** Tabla canal, kilos, plata, precargada con el mes anterior.

**Cruce SKU × canal.** Ajuste biproporcional con celdas en cero forzado y detección de inconsistencias.

**Recorrido completo end-to-end**: input 1 + input 2 → cruce → inconsistencias → exportar. Sin interfaz, sin autenticación.

**Entendimiento del negocio** consolidado en el documento de dominio, listo para validar con el nuevo referente.

---

## 4. Octubre — Construcción

1. Persistencia: modelo en Postgres, migraciones, el motor operando contra la base
2. API con FastAPI y la autenticación detrás de una interfaz
3. **Pantalla central**: carga del input 2, carga de reglas, lista de inconsistencias
4. **Panel de reglas** sobre el catálogo de tipos: alta, edición y baja; herencia desde el mes anterior
5. Aplicación de reglas en el cruce y debajo del canal, con detección de reglas incumplibles y conflictos
6. Excepciones ON/OFF de SKUs, vendedores y distribuidores
7. Re-normalización: SKUs modificados y entidades deshabilitadas
8. Revisión y edición manual: valores fijados, recálculo, registro de interacción humana
9. Front en React: importar, cargar input 2 y reglas, ver inconsistencias, corregir, aprobar
10. Exportación a Excel
11. Enchufar Entra real si IT confirma factibilidad

El panel de reglas es parte del núcleo. Simulación de escenarios, dashboard y carga a SAP quedan fuera hasta que todo lo anterior ande.

A partir de octubre, el entorno de pruebas está arriba (ver sección 6).

---

## 5. Noviembre — Validación y entrega

1. Pruebas con datos reales de varios meses
2. Validación con el usuario real
3. Ajustes
4. Documentación funcional y técnica
5. Entrega y demo

Reservar la última semana completa para documentación y ensayo.

---

## 6. El entorno de pruebas

El cliente lo pidió explícitamente y dio el motivo: al grupo anterior las demos se le veían bien, pero el producto entregado tenía fallas y agujeros.

Quieren **entrar a probar por su cuenta**, no ver demos guiadas.

Qué implica:

- Desplegar seguido a ese entorno desde octubre, no esperar a tener algo lindo
- Que lo que esté publicado funcione de verdad, aunque haga poco
- Tests automáticos antes de invitarlos a romper cosas, no después
- Lo que esté a medias, que se note
- Como cada merge despliega, lo que rompe la rama principal rompe el entorno del cliente: no se mergea sin verificar

Esto también nos sirve para la defensa: un proceso de entrega continua con estrategia de testing se argumenta mejor que un prototipo demostrado en vivo.

---

## 7. Decisiones técnicas propias

### Decimal, nunca float

Todo cálculo de kilos o plata usa `decimal.Decimal` con redondeo explícito. En una cascada de varios niveles los errores de redondeo se acumulan y en la última etapa son imposibles de rastrear.

Regla de code review desde el primer día. El front no calcula: muestra lo que devuelve el backend.

### Reparto de restos con largest remainder

Repartir por porcentaje y redondear no suma el total exacto. Se reparte el sobrante entre las entidades con mayor resto decimal, con desempate determinístico, en cada nivel, y por separado para kilos y facturación.

### Cruce SKU × canal por ajuste biproporcional

Filas = input 1, columnas = input 2, celdas prohibidas en cero. Se parte del reparto del mes anterior y se ajusta alternando filas y columnas (RAS / IPF). Determinístico. Si no converge porque filas y columnas son incompatibles, se informa dónde. Los totales por SKU cierran exacto.

### Pesos relativos

`repartir` recibe pesos relativos, no porcentajes que deban sumar 1. Tres tercios en Decimal suman 0,999…, no 1. Deshabilitar una entidad es sacarla del conjunto. Validar que los porcentajes del Excel sumen 100% es trabajo del importador.

### Árbol de profundidad variable

Cada rama define hasta dónde baja. En Soluciones, Distribuidores termina en distribuidores y la venta directa baja a vendedores. Una escalera fija funciona para el caso simple y se rompe en el complejo.

### Las reglas son una capa sobre el motor

La herramienta implementa un catálogo de tipos de regla; el planner crea las reglas concretas. Las reglas producen restricciones y el motor reparte respetándolas. Una regla fuera del catálogo requiere desarrollo. Son datos persistentes, con vigencia mensual y heredables. Las reglas imposibles de cumplir juntas o en conflicto se detectan y se informan; el sistema no las resuelve en silencio.

### "No aplica" y "aplica con cero" son estados distintos

Que un canal no venda cierto SKU no es lo mismo que venderlo en cantidad cero. El primero no entra al reparto, el segundo sí.

### Re-normalización: una sola regla

Acomodar los porcentajes al modificar un SKU y repartir la parte de una entidad deshabilitada son el mismo mecanismo. Se implementa una vez. Criterio pendiente (A1), proporcional como supuesto.

### Cada nodo tiene valor y estado

Hay que saber si un valor fue **calculado** o **editado a mano**. El valor editado queda fijo, el recálculo no lo pisa y el resto absorbe la diferencia.

- Una edición imposible (negativa o mayor que el padre) se rechaza.
- Si todos los hermanos quedan fijados y el nivel no cierra, el nivel se marca "no cuadra" y bloquea la aprobación.

### Trazabilidad

Cada ajuste registra qué cambió, quién, cuándo y por qué. El autor sale de la interfaz de autenticación.

### Autenticación detrás de una interfaz

Dos implementaciones: un proveedor local para desarrollar y el de Entra real.

### El importador cruza por código

Las hojas se cruzan por código de SKU, nunca por nombre. Columnas detectadas por nombre de encabezado, no por posición.

### Nada de datos reales en el repo

Datos de prueba anonimizados o generados que repliquen la estructura real, incluidos los casos raros. Archivo real en `.gitignore`.

### El motor de dominio, separado

```
domain/            ← reparto, árbol, reglas, cuadratura, re-normalización
  reparto.py       ← largest remainder, aislado y testeado
models/            ← SQLAlchemy
routes/            ← API
```

El dominio no sabe nada de FastAPI ni de la base. Se testea sin levantar servidor.

---

## 8. El factor humano como principio de diseño

El planner pasa a un rol de supervisión: define reglas, revisa el resultado y corrige lo puntual. El sistema hace el trabajo mecánico.

El planner tiene **conocimiento empírico que el histórico no captura**: sabe qué SKUs están mal cargados, qué desvío es real y cuál es error de datos, qué cambió en una cartera.

**La validación humana es el control de calidad del dato**, no un paso administrativo. La aprobación siempre la da una persona, aunque todo cuadre.

---

## 9. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Nestlé tarda en designar nuevo referente | Alto. No se validan las reglas | Pedirlo explícito. Avanzar con el motor y marcar todo supuesto |
| La sesión de observación se corre a octubre | Alto. Se construye con reglas inventadas | Pedir fecha con el nuevo referente |
| El panel de reglas agranda el alcance | Alto. En el funcional figuraba como SHOULD | Catálogo cerrado de tipos; validarlo con los ejemplos reales |
| Reglas reales fuera del catálogo | Medio | Pedir los ejemplos antes de cerrar el catálogo |
| Reglas superpuestas vuelven el reparto un problema de optimización | Medio | Pocos tipos de regla; conflictos se informan, no se resuelven solos |
| Repo del equipo con stack distinto al confirmado | Alto. Reescritura tardía | Alinear ya (E1), antes de que el motor se apoye encima |
| No llegan credenciales del índice privado | Alto. No se puede ni instalar | Preguntarlo esta semana |
| El scaffold no trae persistencia | Medio. Trabajo no contemplado | Modelo de datos en paralelo al motor |
| Errores de redondeo en la cascada | Alto. Rompe la cuadratura | Decimal desde el día uno, tests en CI |
| Entregar algo que se ve bien en demo y falla en uso | Alto | Entorno de pruebas abierto desde octubre |
| Datos personales en el repo | Medio, reputacional | Datos anonimizados, gitignore |

---

## 10. Próximos pasos

1. Pedir a Nestlé la designación del nuevo referente de negocio
2. Conseguir los ejemplos de reglas reales y validar el catálogo de tipos (R7)
3. Validar con el nuevo referente el margen del input 2 (A2), la estructura del árbol (A10) y las preguntas de reglas (R1 a R4)
4. Alinear el repo del equipo con el stack confirmado (E1)
5. Implementar el cruce SKU × canal y terminar el motor de reparto
6. Mandar las preguntas técnicas del scaffold a IT
7. Preguntar el criterio de re-normalización (A1)
