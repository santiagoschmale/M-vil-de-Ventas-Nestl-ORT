# sku

Catálogo de productos. Es la base de todo: objetivos y participación
siempre cuelgan de un SKU.

| Columna | Tipo | Notas |
|---|---|---|
| sku_id | serial, PK | |
| codigo | varchar(30), único | código de producto |
| nombre | varchar(150) | |
| categoria | varchar(80) | opcional |
| activo | boolean, default true | |

**Relaciones:** referenciada por `objetivo_total` y `participacion`.
