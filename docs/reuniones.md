# Reuniones con el cliente

Registro de las reuniones con Nestlé: quiénes estuvieron, qué se mostró, qué
pidieron y qué se decidió. Una entrada por reunión, de la más reciente a la más
vieja.

---

## 05/11/2026 — Prueba del móvil de noviembre

**Presentes**

- Nestlé: Matías Azpiazu, Demian Serbielle, Chiara D'Angelo, Martín Taborda,
  María Pintor, Antonella Arroyo.
- ORT: Santiago Schmale, Fausto Rossi, Maximiliano Monaco, Francisco Bermingham.

**Qué se mostró**

Matías usó la herramienta él mismo, compartiendo pantalla, con la versión que
Martín había desplegado ese día. Recorrió el ciclo completo con el móvil de
noviembre: entrar con su mail y el código, cargar el objetivo, armar los totales
por canal y resolver las alertas de cuadratura.

**Qué pidió Nestlé**

1. **Que los pesos se repartan con la misma regla que los kilos.** Fue el punto
   central. Los kilos se abren bien; los pesos no se actualizaban y mostraban el
   mismo valor para canales con kilos distintos. No pide reglas nuevas: pide
   aplicar a la plata la lógica que ya funciona para los kilos.
2. **No tener que cargar la apertura a mano.** El Excel que manda ya trae kilos y
   plata por SKU; la herramienta tendría que proponer la apertura por canal a
   partir del histórico, y dejar a mano solo lo que no se puede resolver solo.
3. **El precio sale por canal, no promedio.** El precio de cada SKU en cada canal
   se saca de NNS ÷ kilos del histórico de ese canal. Un precio promedio único no
   sirve: a un distribuidor se le vende a otro precio que al cliente final,
   porque el distribuidor tiene su margen en el medio.
4. **Que las categorías lleguen desde Nestlé.** Apareció una advertencia de SKUs
   sin categoría. Matías se comprometió a mandar la tabla SKU → categoría.
5. **Un botón de refresh**, para no tener que recargar la página a mano.

**Qué se decidió**

- **Alcance acordado para el cierre:** que la plata cuadre con los kilos y que el
  algoritmo distribuya hasta los canales que Nestlé defina. El sistema no hace
  recomendaciones comerciales ni evalúa si el histórico elegido es
  representativo: eso lo decide Nestlé.
- Las **categorías** quedan como "tal vez": el equipo analiza cuánto tiempo
  llevan antes de comprometerlas.
- El equipo lleva **dos o tres propuestas** para resolver la distribución
  monetaria esa misma semana.
- El equipo **actualiza el documento de entendimiento** con el alcance acordado.
- Matías manda la **tabla SKU → categoría** y averigua el **formato de salida**
  para cargar los resultados en el sistema.
- Nestlé prepara un **esquema del flujo en cascada**, aunque sea dibujado a mano,
  para que el equipo sepa cómo quieren que se organice la información.
- **Fechas:** entrega la semana del 16 al 20 de noviembre; antes de eso, una demo
  para que Matías la pruebe y devuelva; la demo final con el profesor, jueves o
  viernes de esa semana.

**Contexto que se dejó asentado**

El equipo señaló que no fue autorizado a hacer relevamiento dentro de Nestlé ni a
acompañar a los canales de distribución, y que la persona que armaba el móvil
dejó la empresa a poco de empezar el proyecto. Buena parte del entendimiento del
negocio se reconstruyó desde los archivos y las reuniones, y lo que quedó abierto
se resolvió con supuestos escritos (`docs/preguntas.md`).

---

## 19/10/2026 — Primera demo

**Presentes**

- Nestlé: Demian Serbielle, Chiara D'Angelo, Martín Taborda, Matías Azpiazu.
- ORT: Santiago Schmale, Fausto Rossi, Maximiliano Monaco, Francisco Bermingham,
  Sofía Soler.

**Qué se mostró**

Recorrido completo sobre los datos de muestra: cargar las entradas, resolver lo
que no cierra, ajustar a mano, aprobar, exportar y empezar el mes siguiente.

**Qué pidió Nestlé**

- Foco en la distribución: que eso funcione bien antes que cualquier otra cosa.
- Probar la herramienta con **datos reales** del móvil de noviembre, a fin de esa
  semana o principio de la siguiente.

**Qué se decidió**

- Se confirmaron los supuestos **B1** (en lo principal) y **B2**.
- Se confirmó el **cierre exacto, sin margen** (supuesto A2): es el objetivo
  variable de cada vendedor, así que no admite redondeo hacia arriba o abajo.
- **Python obligatorio** como lenguaje, definido por IT.
- Alcance: **Professional Argentina**; SAP es *nice to have*.
- **Entorno de pruebas abierto al cliente**: Nestlé quiere probar por su cuenta y
  no ver demos guiadas. Al grupo anterior las demos le andaban y el producto no.
