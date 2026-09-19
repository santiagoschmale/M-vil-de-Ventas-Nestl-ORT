# regla_distribucion

Reglas de negocio por canal, para que no queden hardcodeadas en el
código (topes, estacionalidad, base de cálculo, etc).

| Columna | Tipo | Notas |
|---|---|---|
| regla_id | serial, PK | |
| canal_id | integer, FK → canal | |
| nombre | varchar(120) | |
| tipo | varchar(30) | `tope` \| `estacional` \| `base_calculo` \| a definir |
| parametros_json | jsonb | flexible hasta tener ejemplos reales de reglas por canal |
| activo | boolean, default true | |

**Estado:** PROVISORIO — estructura mínima hasta tener ejemplos reales
de reglas por canal, pendiente de la reunión con Fernanda.

**Relaciones:** pertenece a un `canal`.
