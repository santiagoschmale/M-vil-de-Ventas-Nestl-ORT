# Minuta — Reunión Nestlé

Participantes: referente de negocio (rol entre Contraloría y canales) + referente de IT.

---

## Lo que dijeron

### Estructura del reparto

- El SKU se abre por canal.
- **No todos los SKUs se venden por todos los canales.** Un canal no necesariamente tiene todos los SKUs.
- **Los canales no se abren todos igual.** Catering, Vending, Mayoristas y KAM cierran a nivel canal.
- Igual **necesitan llegar hasta vendedor** en el tramo de distribuidores y asesores.
- No saben todavía si un canal que hoy cierra arriba (Catering, por ejemplo) podría abrirse por vendedor más adelante.

### SKUs

- Los SKUs que aparecen en cero son **obsoletos o estacionales**.
- Si se modifica un SKU, **los porcentajes se tienen que acoplar** para seguir cerrando.
- Sobre los desvíos en los controles del archivo: **no deberían existir**. Si aparecen, se corrige el SKU.

### Histórico

- Tienen una base histórica considerada para el cálculo.
- Del histórico quieren saber **cómo quedó abierto el reparto** y conservar la interacción humana. No necesitan que se guarden las reglas que se aplicaron.

### Factor humano

Lo remarcaron varias veces. El planner tiene **conocimiento empírico** que el histórico no captura: sabe qué SKUs están mal cargados, qué desvío es real y cuál es error de datos, qué cambió en una cartera.

El sistema propone desde el histórico, pero **la validación humana es el control de calidad del dato**, no un paso administrativo.

### Alcance

- **Piloto: Professional Argentina.**
- **SAP: nice to have.** No es obligatorio.

### Entorno de pruebas

Piden un ambiente donde **ellos** puedan probar por su cuenta, no demos guiadas.

Motivo que dieron: al grupo anterior le pasó que las demos se veían bien, pero el producto entregado tenía fallas y agujeros.

### Técnico

- Usan **Backstage** (genera el scaffold del monorepo) y **ArgoCD** (deploy).
- Hay **entorno sandbox** disponible.
- QA: **TestSprite**.

### Nos mandan

- Los ejemplos de reglas de negocio que habíamos pedido.

---

## Lo que leemos nosotros

Esto no lo dijo el cliente, es nuestra conclusión a partir de lo anterior.

**Territorio no aparece en la cascada.** En toda la reunión se recorrió canal → distribuidor → vendedor y no se mencionó territorio en ningún momento. Lo damos por descartado como nivel de apertura.

**El modelo de datos tiene que ser un árbol de profundidad variable.** Si algunos canales cierran arriba y otros bajan hasta vendedor, no podemos modelar una escalera fija de niveles. Cada rama define hasta dónde llega.

**"No aplica" y "aplica con cero" son estados distintos.** Que un canal no venda cierto SKU no es lo mismo que venderlo en cantidad cero. El primero no entra al reparto, el segundo sí. Si se confunden, la cuadratura da mal.

**Re-normalizar es una sola regla, no dos.** Acomodar los porcentajes al tocar un SKU y repartir la parte de un distribuidor deshabilitado son el mismo mecanismo: cuando cambia el conjunto de entidades activas, los porcentajes se recalculan sobre el nuevo total. Conviene implementarlo una vez.

**Cada nodo necesita valor y estado.** No alcanza con guardar el número: hay que saber si fue calculado o editado a mano. Sin eso no se puede fijar un valor para que el recálculo no lo pise, y tampoco se puede cumplir lo que pidieron de conservar la interacción humana.

**El entorno de pruebas sube de prioridad.** Deja de ser algo de noviembre. Implica desplegar seguido desde octubre y tener tests antes de invitarlos a probar.

---

## Pendientes

- Recibir los ejemplos de reglas de negocio.
- **Coordinar la sesión para ver el armado del móvil en vivo.** Los ejemplos escritos no la reemplazan.
- Confirmar si TestSprite es obligatorio o sugerido.
- Confirmar si algún canal que hoy cierra arriba podría abrirse por vendedor.
