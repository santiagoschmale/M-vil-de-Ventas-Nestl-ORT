# objetivo_total

El input que manda Contraloría: cuánto hay que vender de cada SKU en
cada período. Es el número que después se reparte en cascada por
`participacion`.

| Columna | Tipo | Notas |
|---|---|---|
| objetivo_id | serial, PK | |
| sku_id | integer, FK → sku | |
| periodo | char(7) | formato `YYYY-MM` |
| kilos | decimal(14,3) | |
| facturacion | decimal(14,2) | |
| creado_por | varchar(80) | quién lo cargó (Contraloría) |
| fecha_creacion | timestamptz, default now() | |

**Restricción:** único por `(sku_id, periodo)` — no puede haber dos
objetivos para el mismo SKU en el mismo mes.

**Relaciones:** pertenece a un `sku`.
