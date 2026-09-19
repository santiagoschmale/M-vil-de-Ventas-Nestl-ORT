# excepcion

Permite deshabilitar una entidad (SKU, vendedor o distribuidor) para
un período puntual, sin borrar nada ni tocar el histórico.

| Columna | Tipo | Notas |
|---|---|---|
| excepcion_id | serial, PK | |
| entidad_tipo | varchar(20) | `sku` \| `vendedor` \| `distribuidor` |
| entidad_id | integer | FK lógica, igual criterio que en `participacion` |
| periodo | char(7) | |
| activo | boolean, default true | `false` = deshabilitado para ese período |
| motivo | varchar(200) | |
| creado_por | varchar(80) | |
| fecha_creacion | timestamptz, default now() | |

**Uso típico:** habilitar/deshabilitar antes de correr el reparto de
un período (ej: un vendedor de licencia, un SKU discontinuado ese mes).
