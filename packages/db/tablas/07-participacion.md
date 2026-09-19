# participacion

La tabla central del motor: cómo se reparte el `objetivo_total` en
cascada (canal → territorio → vendedor → distribuidor, según hasta
dónde llegue cada canal).

| Columna | Tipo | Notas |
|---|---|---|
| participacion_id | bigserial, PK | |
| sku_id | integer, FK → sku | |
| periodo | char(7) | `YYYY-MM` |
| entidad_tipo | varchar(20) | `canal` \| `territorio` \| `vendedor` \| `distribuidor` |
| entidad_id | integer | **FK lógica**, no real — apunta a la tabla que corresponda según `entidad_tipo`. Se valida en la capa de aplicación, no en la base. |
| parent_participacion_id | bigint, FK → participacion (self) | nulo en el nivel más alto |
| porcentaje | decimal(9,6) | ej: `0.103000` = 10.3% |
| origen | varchar(20) | `historico` \| `manual` |
| kilos_calculados | decimal(14,3) | resultado ya aplicado sobre el nivel padre |
| aprobado | boolean, default false | |
| modificado_por | varchar(80) | |
| fecha_modificacion | timestamptz, default now() | |

**Por qué es genérica (entidad_tipo + entidad_id) y no una tabla por
nivel:** así la cascada puede tener profundidad distinta por canal sin
tener que rediseñar el modelo — es justamente lo que resuelve
`canal.profundidad_maxima`.

**Índice:** `(sku_id, periodo, entidad_tipo, entidad_id)` para las
consultas de reparto, que siempre filtran por esas cuatro columnas.

**Vista `vw_CuadraturaPorPadre`:** suma `porcentaje` agrupado por
`parent_participacion_id`. La aplicación tiene que bloquear (o
alertar) que se pase a `aprobado = true` si esa suma no da 100% dentro
de una tolerancia definida.
