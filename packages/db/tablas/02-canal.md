# canal

Los canales de venta (Catering, Vending, Mayoristas, KAM, Soluciones).

| Columna | Tipo | Notas |
|---|---|---|
| canal_id | serial, PK | |
| nombre | varchar(60), único | |
| profundidad_maxima | varchar(20), default 'canal' | **PROVISORIO** — valores esperados: `canal` \| `territorio` \| `vendedor` \| `distribuidor`. Pendiente de confirmar con Nestlé (supuesto bloqueante #1). |

**Por qué existe `profundidad_maxima`:** no todos los canales bajan
la cascada hasta el mismo nivel. Este campo le dice al motor hasta
dónde repartir sin tener que tocar el modelo cuando llegue la
confirmación de Nestlé.

**Relaciones:** referenciada por `territorio` y `regla_distribucion`.
