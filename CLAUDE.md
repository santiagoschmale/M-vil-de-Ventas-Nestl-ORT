# CLAUDE.md

Motor del Móvil de Ventas para Nestlé Professional Argentina: reparte el objetivo
mensual de ventas (el "móvil") a partir de los lineamientos del planner, marca lo
que no puede cerrar y deja que una persona lo ajuste. Proyecto final de la
Universidad ORT, sep-nov 2026. Equipo de estudiantes sin experiencia laboral,
liderado por un dev con experiencia.

Además de software real, es un trabajo que evalúa un tribunal: las decisiones de
diseño tienen que poder justificarse. Si una decisión es por comodidad, decilo.

Este archivo lo leen las personas del equipo y Claude Code. Si una regla de acá
deja de ser cierta, se cambia acá en el mismo PR que la cambia.

## El dominio en 30 segundos

Referencia completa: `docs/entendimiento-negocio.md` (cada afirmación marcada
como confirmada, de datos o a confirmar).

- **Qué resuelve**: el planner carga sus lineamientos y **la herramienta hace el
  primer reparto sola**. El planner revisa y corrige solo lo que no cierra. Rol de
  supervisión, no de armado a mano. **No es un modelo predictivo.**
- **Flujo**: input 1 + input 2 + reglas → reparto automático → inconsistencias →
  ajuste humano → aprobación → Excel.
- **Input 1** (Contraloría): SKU, kilos, plata. Lo esencial es SKU y kilos. El
  total por SKU **cierra exacto**.
- **Input 2** (el planner): canal, kilos, plata. Tabla pegada cada mes,
  precargada con la del mes anterior. La plata es por canal (cada canal tiene su
  precio): **la herramienta no valoriza**.
- **El cruce SKU × canal es el centro del cálculo**: filas que suman el input 1,
  columnas que suman el input 2, cero forzado donde el SKU no se vende. Se parte
  del reparto del mes anterior y se ajusta por **ajuste biproporcional (RAS /
  IPF)**. Si filas y columnas no pueden cumplirse a la vez, se marca dónde.
- **Debajo del canal**, reparto con largest remainder hacia distribuidores y
  vendedores. **Profundidad variable**:
  - **Ingredientes**: Catering, Vending, Mayoristas, KAM Ingredientes. Cierran
    en el canal.
  - **Soluciones**: Distribuidores (→ 5 distribuidores), Directa (BA), Córdoba,
    Rosario (→ vendedores, a confirmar A10) y KAM Sol. Los territorios existen y
    en el input 2 figuran como canales.
- **Reglas**: catálogo de tipos (total por canal, dónde se vende un SKU, tope o
  mínimo en %, valor fijo en kilos). El planner crea las reglas concretas; se
  heredan del mes anterior. Las que no se pueden cumplir o chocan **se
  informan**, no se resuelven solas.
- **Excepciones ON/OFF** (MUST): prender o apagar SKUs, vendedores y
  distribuidores antes del reparto.
- **Cuadratura**: en cada nivel la suma de las partes da **exactamente** el total
  de arriba. Kilos y plata por separado.
- **Usuario**: el planner (~20 concurrentes, web desktop). El vendedor no entra al
  sistema.
- **Integración**: entra un Excel (y el input 2 pegado), sale un Excel. SAP es
  nice to have.

## Reglas innegociables

1. **Decimal, nunca float**, en cualquier cálculo de kilos o plata:
   `decimal.Decimal` con redondeo explícito. Los montos viajan por la API como
   **string**. El front no calcula: muestra lo que devuelve el backend.
2. **Cuadratura exacta con redondeo controlado.** Debajo del canal, largest
   remainder con desempate determinístico. En el cruce, el redondeo tiene que
   respetar filas y columnas a la vez. Nunca "objetivo × producto de los % de la
   cadena": redondea en cada nivel y las hojas dejan de sumar el total.
3. **Canales, territorios, distribuidores, vendedores, reglas y tipos de regla son
   datos**, nunca código. Ni enums, ni constantes, ni `if canal == "Catering"`.
4. **Cada nodo tiene valor y estado** (calculado / editado a mano). Lo editado
   queda fijo y el recálculo no lo pisa; el resto absorbe la diferencia.
5. **"No aplica" ≠ "aplica con cero"**. Un canal que no vende un SKU no entra al
   reparto (cero forzado en el cruce); uno que lo vende en cero, sí.
6. **Trazabilidad**: cada ajuste registra qué cambió, quién, cuándo y **por qué**.
7. **Ningún dato real de Nestlé en el repo.** Ni archivos, ni cifras, ni nombres de
   clientes o vendedores. `data/real/` está en `.gitignore`. Los datos de prueba
   son inventados y replican la estructura real, incluidos los casos raros.
8. **Los desvíos del archivo (participaciones negativas, checks que no suman 100%)
   son errores**: se detectan y reportan, no se replican.
9. **Inconsistencias y conflictos de reglas se informan**, nunca se resuelven en
   silencio.
10. **Validación humana obligatoria.** La aprobación la da una persona aunque todo
    cuadre.

## Stack (cerrado por el cliente)

- **Backend: Python + FastAPI. Base: PostgreSQL. Frontend: React.** Monorepo
  generado por Backstage (`docs/template-reference.md`), GitHub Enterprise con
  cuentas @ort. Deploy con ArgoCD: cada merge dispara el pipeline que declara
  Nestlé y hay entorno sandbox.
- **Autenticación: Microsoft Entra ID**, sujeta a la factibilidad que informe IT.
  Mientras tanto, detrás de una interfaz con proveedor local.
- **E1: el repo del equipo tiene la API en Express + Prisma y un servicio de Excel
  aparte. Hay que alinearlo al stack confirmado**: motor, reglas e importador en
  Python, sobre la estructura del template. Hasta que se alinee, no construir
  lógica de negocio nueva sobre `apps/api`.

## Decisiones ya tomadas (no reabrir sin avisar)

- **El dominio va separado** (`domain/`: reparto, cruce, árbol, reglas,
  cuadratura). No importa FastAPI ni la base. Se testea sin levantar servidor.
- El reparto recibe **pesos relativos**, no porcentajes que sumen 1. Motivo: tres
  tercios en Decimal suman 0,999..., no 1. Deshabilitar una entidad = sacarla del
  reparto. Validar que los % del Excel sumen 100% es trabajo del importador.
- **Re-normalización: una sola regla.** Modificar un SKU y repartir la parte de
  una entidad deshabilitada son el mismo mecanismo. Proporcional como supuesto
  (A1).
- **Las reglas son una capa sobre el motor**: producen restricciones y el motor
  reparte respetándolas. Son datos persistentes, con vigencia mensual y heredables.
- **El recálculo es del backend.** Una sola versión del móvil para todos los
  planners y una sola implementación de la cuenta.
- **Edición**: la imposible se rechaza (negativa o mayor que el padre). Si todos
  los hermanos quedan fijados y el nivel no cierra, se permite, queda marcado "no
  cuadra" y bloquea la aprobación. Kilos y plata se fijan por separado.
- **El importador cruza por código de SKU**, nunca por nombre, y detecta columnas
  por nombre de encabezado, no por posición.
- **El autor de cada ajuste** sale de la interfaz de autenticación, nunca
  hardcodeado en el dominio.

## Pendiente del cliente (no inventar respuestas)

Lista completa con prioridades: `docs/plan.md`, sección 0 ("Abierto").

- **A1** criterio de re-normalización (hoy proporcional, supuesto).
- **A2** si el input 2 admite margen (se mencionó ±500 kg) o cierra exacto.
- **A4** SKU sin reparto previo: cómo se abre.
- **A10** dónde cuelgan territorios y vendedores dentro de Soluciones.
- **A11** los 2 SKUs que están en Ingredientes y en Soluciones.
- **R1–R7** base del %, nivel de cada regla, topes compartidos, reglas
  incumplibles, prioridades, validar el catálogo con los ejemplos reales.

## Estado del entorno

El repo real de Nestlé (scaffold de Backstage) todavía no está disponible.
Trabajamos acá.

- Las librerías internas `nbra-*` y el registry npm privado **no son accesibles**.
  No las agregues. Usá reemplazos locales con la misma interfaz, marcados para
  cambiarlos por los reales.
- Tests del dominio con `assert` plano. El template trae nose2; si es obligatorio
  o se puede usar pytest está preguntado a IT.

## Documentos

No se cargan solos: leé el que la tarea pida antes de actuar.

| Doc | Para qué |
|---|---|
| `docs/entendimiento-negocio.md` | **Referencia de dominio vigente**: flujo, inputs, cruce, estructura, reglas |
| `docs/plan.md` | Plan de trabajo vivo: decisiones cerradas, abiertas, riesgos, próximos pasos |
| `docs/alcance.md` | Alcance funcional por épicas |
| `docs/minuta.md` | Qué dijo el cliente en la primera reunión |
| `docs/preguntas.md` | Preguntas enviadas a IT y a negocio |
| `docs/contexto-negocio.md` | Cómo se arma hoy el móvil, contado desde el planner |
| `docs/template-reference.md` | Estructura del scaffold que entrega Nestlé |

Si se contradicen, **gana `docs/entendimiento-negocio.md`**: es lo último que
validó el cliente. Si algo del código contradice una regla de arriba, frená y
avisá.

## Cómo trabajar

- Test primero en todo lo del dominio.
- Cambios chicos, verificables. Corré los tests antes de dar algo por terminado.
- Señalá decisiones en vez de asumirlas. Si hay dos caminos, proponé y esperá.
- Comentarios y docstrings en español. Código (nombres) en español del dominio
  donde tenga sentido: `repartir`, `cuadra`, `participacion`.
