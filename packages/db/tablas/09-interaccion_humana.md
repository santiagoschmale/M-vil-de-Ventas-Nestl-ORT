# interaccion_humana

Auditoría de ajustes manuales. No existía en el borrador original de
`04-diseno-tecnico` — sale del alcance del MVP (Trello: "Registro de
interacción humana — qué se ajustó y por qué") y de la historia de
Excepciones ON/OFF, que exige razón obligatoria al deshabilitar algo.

| Columna | Tipo | Notas |
|---|---|---|
| interaccion_id | serial, PK | |
| entidad_tipo | varchar(20) | `participacion` \| `excepcion` |
| entidad_id | bigint | FK lógica, mismo criterio que en `participacion`/`excepcion` |
| accion | varchar(30) | `ajuste_manual` \| `deshabilitar` \| `habilitar` \| `aprobacion` |
| motivo | varchar(200) | **obligatorio** — a diferencia de `excepcion.motivo`, que es opcional |
| realizado_por | varchar(80) | |
| fecha | timestamptz, default now() | |

**Por qué es obligatorio acá y no en `excepcion`:** `excepcion.motivo`
es el motivo de negocio de por qué esa entidad está deshabilitada
(puede no cargarse al toque). `interaccion_humana` es el registro de
auditoría de que alguien tocó algo a mano — para eso la UI exige
la razón sí o sí antes de guardar.

**Índice:** `(entidad_tipo, entidad_id)`, mismo patrón que
`IX_Participacion_lookup`, para traer el historial de una entidad
puntual sin escanear toda la tabla.
