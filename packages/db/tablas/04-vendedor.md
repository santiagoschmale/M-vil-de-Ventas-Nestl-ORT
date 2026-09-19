# vendedor

Vendedores dentro de un territorio.

| Columna | Tipo | Notas |
|---|---|---|
| vendedor_id | serial, PK | |
| codigo | varchar(30), único | pensado para poder anonimizarse (A/B/C) según lo que se acuerde con Nestlé |
| territorio_id | integer, FK → territorio | |
| activo | boolean, default true | |

**Relaciones:** pertenece a un `territorio`.
