# distribuidor

Distribuidores externos, el nivel más bajo posible de la cascada
(cuando el canal llega hasta ahí — ver `canal.profundidad_maxima`).

| Columna | Tipo | Notas |
|---|---|---|
| distribuidor_id | serial, PK | |
| codigo | varchar(30), único | |
| nombre | varchar(150) | opcional |
| activo | boolean, default true | |

**Relaciones:** ninguna FK entrante directa — se referencia de forma
lógica desde `participacion.entidad_id` cuando `entidad_tipo = 'distribuidor'`.
