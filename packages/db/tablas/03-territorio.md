# territorio

Subdivisión geográfica/comercial dentro de un canal.

| Columna | Tipo | Notas |
|---|---|---|
| territorio_id | serial, PK | |
| nombre | varchar(80) | |
| canal_id | integer, FK → canal | |

**Relaciones:** pertenece a un `canal`, referenciada por `vendedor`.
