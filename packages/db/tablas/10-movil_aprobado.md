# movil_aprobado

Histórico de cierres. Guarda una foto completa de cómo quedó el
período aprobado — no solo el número final, sino las reglas vigentes
en ese momento.

| Columna | Tipo | Notas |
|---|---|---|
| movil_id | serial, PK | |
| periodo | char(7), único | un cierre por período |
| aprobado_por | varchar(80) | Sales Planning Lead |
| fecha_aprobacion | timestamptz, default now() | |
| snapshot_json | jsonb | copia completa de `participacion` + reglas vigentes ese mes |

**Por qué jsonb y no una tabla normalizada:** es un snapshot de
auditoría, no algo que se vaya a consultar campo por campo — Postgres
permite indexarlo/consultarlo igual si hiciera falta más adelante.
