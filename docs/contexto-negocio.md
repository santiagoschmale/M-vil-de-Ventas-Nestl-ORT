# El móvil de ventas de Nestlé: cómo se arma hoy y dónde entra el sistema

Documento de contexto para el equipo de desarrollo de la Universidad ORT.
Proyecto: POC Distribución del Móvil, Nestlé DIL Región Plata, septiembre a noviembre de 2026.

Este texto está escrito desde el punto de vista de la persona que hoy arma el móvil todos los meses. La idea es entender su trabajo antes de proponerle un sistema. Todo lo que se afirma acá sale del Documento Funcional v1.0 del cliente y del análisis directo del archivo de distribución de mayo de Argentina.

---

## Parte 1. Qué es el móvil y dónde arranca el proyecto

El móvil de ventas es la meta comercial del mes. Cuánto tiene que vender cada persona del equipo comercial, expresado en dos unidades a la vez: kilos de producto y pesos de facturación.

Se llama "móvil" porque se rearma todos los meses. No es un plan anual que se define en diciembre y se cumple; es un objetivo que se recalcula cada ciclo mensual.

El brief del cliente habla de "móvil / forecast de ventas", y está bien dicho: hay un pronóstico de demanda dando vueltas en este circuito. Lo que importa entender es dónde está parado el proyecto respecto de ese pronóstico.

Alguien en Nestlé proyecta la demanda, y de ahí sale el objetivo que después baja el área de Contraloría. Pero cuando ese número llega al proceso que vamos a digitalizar, ya está cerrado y no se discute. El trabajo de la persona que arma el móvil empieza justo después: agarrar ese número y repartirlo hacia abajo, entre canales, vendedores y clientes.

Dicho de otra manera, es un presupuesto que baja más que una predicción que sube. Y eso tiene una consecuencia práctica muy concreta para el equipo de desarrollo: no hay que construir ningún modelo predictivo. No hace falta forecasting ni inteligencia artificial que estime demanda. Lo que hace falta es un mecanismo de reparto en cascada donde cada nivel sume exactamente lo que le dio el nivel de arriba, donde una persona pueda intervenir en cada paso, y donde quede registro de quién tocó qué.

Vale igual llevarse la pregunta: de dónde sale el número de Contraloría, con qué método se calcula y cada cuánto se revisa. No es parte del alcance, pero define la calidad del dato con el que se va a trabajar.

## Parte 2. El vocabulario mínimo

Antes de contar el proceso conviene fijar algunos términos que van a aparecer todo el tiempo.

**Kilos y NNS.** Todo se reparte en dos unidades simultáneas. Los kilos son el volumen físico. El NNS, que significa Net Net Sales, es la facturación después de descontar promociones y bonificaciones. Existe además una variante llamada NNS con IIBB, que le suma el impuesto provincial de Ingresos Brutos. Lo importante es que kilos y plata no son proporcionales entre sí, porque cada producto tiene precio distinto. Eso significa que el sistema tiene que cuadrar dos totales en paralelo, no uno.

**SKU.** Cada producto individual con su código. Por ejemplo, un código de ocho dígitos corresponde a un café soluble en presentación de 2 por 1 kilo. Todo el reparto se hace producto por producto.

**Participación.** El porcentaje que le toca a cada actor del reparto. Sale de mirar cuánto vendió históricamente. Si el canal Catering se llevó el 22 por ciento de las ventas de un producto durante el año pasado, se lleva el 22 por ciento del objetivo de ese producto este mes. Es una regla de tres.

**Canal.** La vía por la que el producto llega al consumidor. En este negocio, que es Nestlé Professional y le vende a empresas y no a supermercados, los canales son Catering, que es comida institucional como comedores y hoteles; Vending, que son máquinas expendedoras; Mayoristas, que revenden; KAM Ingredientes, que es venta a granel a otras industrias que usan el producto como insumo; y Soluciones, que es el canal más complejo porque se divide entre un Call Center y una red de distribuidores.

**Vendedor.** Una persona del equipo comercial de Nestlé. Es un empleado, no un local. Cada uno tiene asignada una cartera de clientes.

**Cuadratura.** Que los totales cierren. La suma de lo asignado a todos los vendedores tiene que dar exactamente el total del canal. Esta es la validación central de todo el proceso.

## Parte 3. Un mes en la vida de quien arma el móvil

Vamos a contar el proceso como lo vive la persona que lo hace. En el documento funcional esa persona aparece como Sales Planning Lead. El proceso, tal como está descrito, toma entre cuatro y cinco horas por país cada mes.

### Arranca con un número que no discute

El ciclo empieza cuando Contraloría define los objetivos totales del mes por categoría y por producto. En el archivo de mayo de Argentina que compartieron, ese número total es del orden de cientos de miles de kilos y miles de millones de pesos, repartidos en un listado de 108 productos.

Ese número llega y no se negocia. Es el input maestro. Todo lo que viene después tiene que sumar exactamente eso.

### Abre el Excel y empieza a repartir

El armado se hace en una planilla. La planilla tiene dos partes.

La primera hoja tiene el objetivo del mes, producto por producto, con sus kilos y su facturación. Un detalle llamativo del archivo de mayo: de los 108 productos listados, solamente 45 tienen un objetivo distinto de cero. Los otros 63, casi el sesenta por ciento del catálogo, están en la lista pero apagados. Nadie documentó por qué. Puede ser estacionalidad, pueden ser productos discontinuados que quedaron en la base, o puede ser un recorte del archivo de prueba. No lo sabemos todavía.

La segunda hoja tiene la historia. Es la venta real del año anterior, de enero a diciembre de 2025, abierta por producto y por actor. Y esa venta convertida a porcentaje. De ahí salen las participaciones que se van a aplicar.

Esta segunda hoja está armada en cuatro bloques apilados uno debajo del otro, y cada bloque tiene una estructura distinta. El primero abre 17 productos entre los cuatro canales simples. El segundo abre 38 productos entre cinco distribuidores nombrados uno por uno. El tercero abre esos mismos 38 productos entre el Call Center y la red de distribuidores. El cuarto los abre entre quince columnas de vendedores, cada uno con nombre y apellido.

Esa estructura despareja no es un descuido de armado. Es el reflejo de que cada canal se abre a distinta profundidad. Los canales de Catering, Vending, Mayoristas y KAM Ingredientes se cierran a nivel canal y no bajan más. Solo el canal Soluciones baja hasta distribuidor y hasta vendedor. El sistema que se construya tiene que soportar esa asimetría; no puede asumir que todos los caminos tienen la misma cantidad de niveles.

### El trabajo real: ajustar a mano hasta que cierre

Acá está el corazón del problema, y es la parte que ningún diagrama captura bien.

Aplicar los porcentajes es instantáneo. Lo que consume las cuatro o cinco horas es lo que viene después. El responsable mira el resultado que le dio la fórmula y empieza a corregirlo con criterio propio. Sube y baja participaciones dos o tres puntos. Cambia la mezcla entre canales. Abre un caso particular por distribuidor. Y cada vez que toca algo, los totales dejan de cerrar y hay que recuadrar todo lo de abajo a mano.

Ese criterio con el que ajusta no está escrito en ninguna parte. Vive en la cabeza de la persona. El documento funcional lo dice con todas las letras: las reglas de distribución no están documentadas ni centralizadas, y hay una alta dependencia del conocimiento de personas específicas.

Y ese criterio existe por buenas razones. Si a un vendedor le cambiaron la cartera de clientes el mes pasado, su historia deja de representar lo que puede vender ahora, y hay que asignarle un porcentaje a mano en lugar de usar el histórico. Si un distribuidor entró en convocatoria de acreedores, hay que sacarlo del reparto, pero su volumen no desaparece: hay que repartirlo entre los demás. Si un producto se discontinuó, hay que apagarlo. Todo eso hoy se resuelve editando celdas.

### Cierra y lo manda

Cuando los totales finalmente cuadran, el móvil queda aprobado y se distribuye al equipo comercial. Pero el circuito no termina ahí. El Excel aprobado se le manda a un equipo externo, Nestlé Business Services, que lo carga en SAP validando errores línea por línea.

Y en ese tramo pasó el incidente que mejor explica por qué existe este proyecto. Una vez se cargó un móvil donde los totales generales cerraban perfecto, pero las aperturas por vendedor estaban invertidas. El error pasó todos los controles porque los controles miraban el total. Se terminó duplicando el volumen de un móvil entero y nadie lo detectó a tiempo.

Ese incidente es la prueba de que validar solo el total no alcanza. Hay que validar la cuadratura en cada nivel de apertura, y hay que poder rastrear de dónde salió cada número.

## Parte 4. Valorización: pasar de kilos a plata

El brief original menciona tres cosas al mismo nivel: construcción, valorización y distribución del móvil. La valorización es la que menos desarrollada está en toda la documentación, y conviene mirarla de cerca porque esconde una pregunta sin responder.

Valorizar es convertir el volumen en dinero. Los kilos y la facturación viajan juntos por toda la cascada, pero no son proporcionales entre sí, porque cada producto tiene su precio. En un reparto simple eso no genera problema: se aplica el mismo porcentaje a las dos columnas y listo. El problema aparece en los casos de excepción. Si hay que redistribuir el volumen de un distribuidor que se dio de baja, y el criterio de redistribución no es estrictamente proporcional, entonces los kilos y la plata pueden divergir. Y ahí hay que decidir cuál de los dos manda.

El análisis del archivo de mayo dejó una pista importante. Calculamos el precio implícito por kilo, dividiendo facturación por volumen, y lo comparamos contra el mismo cálculo hecho sobre la venta del año anterior. Para los productos que están en ambos lados, la relación no es constante: va desde tres por ciento hasta veintinueve por ciento de diferencia según el producto. Si se tratara de un ajuste único por inflación, el porcentaje sería el mismo para todos.

Eso significa que existe una lista de precios por producto que se está aplicando en algún lugar del proceso, y esa lista no está en el archivo que se compartió.

De ahí salen cuatro preguntas que hay que hacerle al negocio. ¿Contraloría entrega el móvil ya valorizado, o el sistema tiene que valorizarlo? Si tiene que valorizarlo, ¿de dónde sale la lista de precios? ¿Esa lista queda congelada al momento de armar el móvil, o se actualiza durante el mes? Y cuando la persona ajusta a mano el resultado, ¿qué se respeta primero, el volumen o la facturación?

## Parte 5. Lo que se sabe del estado de los datos

Antes de diseñar nada conviene mirar con qué datos se va a trabajar. El análisis del archivo de mayo dejó varias cosas a la vista.

**El volumen está muy concentrado.** De los 45 productos con objetivo, apenas 12 concentran el ochenta por ciento de los kilos. El resto es una cola larga de bajo volumen. Eso abre una oportunidad de diseño interesante: en lugar de pedirle a la persona que revise 108 productos con el mismo nivel de atención, el sistema podría concentrar la revisión humana en el puñado que define el resultado.

**Hay controles internos que no cierran.** La planilla tiene una columna de verificación que debería sumar cien por ciento por producto, y en más de la mitad de los casos con datos no cierra. Hay desvíos de más ciento cincuenta por ciento y, más grave, hay participaciones negativas. Una participación negativa es matemáticamente imposible en un reparto. Los casos se concentran en productos accesorios de bajo volumen, como platos y tazas de servicio de café, y no en los productos que definen el grueso del objetivo. Es plausible que sea el comportamiento de las fórmulas ante productos sin ventas en el período, pero eso hay que confirmarlo con el negocio antes de replicar la lógica.

**Hay mezcla de países.** El archivo se presenta como de Argentina, pero contiene productos de Uruguay, Brasil, Chile y Perú. Y no son casos marginales: uno de los productos uruguayos está entre los más grandes del mes.

**Hay suciedad de catálogo.** Existen dos categorías escritas distinto que probablemente sean la misma. Hay un producto con kilos asignados pero facturación en cero. Hay decenas de celdas con errores de búsqueda sin resolver.

**Hay una ambigüedad de identidad.** En el bloque de vendedores, quince columnas corresponden en realidad a doce personas. Tres de ellas aparecen dos veces, con un sufijo distinto que parece indicar de qué sistema de origen viene el dato. Eso plantea una pregunta de modelado que hay que resolver antes de escribir código: la entidad que recibe el móvil, ¿es la persona, o es la combinación de persona y sistema de origen?

**Falta un nivel entero.** El documento funcional describe una cadena de cuatro niveles que pasa por canal, territorio, vendedor y distribuidor. Pero en todo el archivo compartido no aparece ninguna referencia a territorio, región, zona ni provincia. Ninguna. Eso deja una pregunta abierta y bastante importante: o el archivo está incompleto, o el nivel territorio no existe realmente en la operación y la cadena tiene un nivel menos de lo que dice el documento.

## Parte 6. Dónde entra el sistema

El sistema no reemplaza a la persona que arma el móvil. Esto es central y conviene decirlo explícitamente, porque define el alcance.

El criterio comercial se queda con la persona. Lo que el sistema elimina es el trabajo mecánico: propagar porcentajes, recalcular cuando algo cambia, verificar que los totales cierren, y dejar registro de qué se hizo. El sistema propone; la persona decide y aprueba.

El proceso rediseñado organiza el armado como una cadena de etapas encadenadas, con un punto de control humano en cada una. El sistema reparte por canal y la persona revisa. Reparte por territorio y la persona revisa. Reparte por vendedor y la persona revisa. Reparte por distribuidor y la persona revisa. Y si en cualquier momento la persona ajusta una etapa, el sistema recalcula automáticamente todas las etapas siguientes preservando la cuadratura.

Ese recálculo en cascada, con estado intermedio editable y trazable, es el corazón técnico del proyecto.

Alrededor de eso hay tres capacidades que el brief original no contemplaba y que salieron de la sesión de trabajo con el negocio.

La primera es poder elegir la base de cálculo caso por caso. Para cada vendedor o distribuidor se puede indicar si se reparte según su histórico o según un porcentaje cargado a mano. Existe precisamente para resolver el caso del vendedor con cartera nueva, cuya historia ya no lo representa.

La segunda es la gestión de excepciones antes de ejecutar. Poder encender y apagar productos, vendedores o distribuidores antes de que corra el reparto. Y acá hay un detalle escondido que no es trivial: cuando se apaga un distribuidor, su volumen no se evapora, hay que redistribuirlo entre los que quedan. El documento dice que eso se hace "con el criterio que se defina", lo cual significa que ese criterio todavía no está definido.

La tercera es que el histórico se realimente. Cada móvil aprobado queda guardado y sirve como base para calcular el mes siguiente. El sistema construye su propia memoria con el uso.

A todo eso se suma una salida en Excel compatible con el proceso actual. No es nostalgia: el equipo que carga en SAP trabaja con Excel, así que el formato de salida está determinado por el sistema de destino.

## Parte 7. Qué queda explícitamente afuera

Definir lo que no se hace es tan importante como definir lo que sí, sobre todo en un plazo de tres meses.

El sistema no reemplaza la validación comercial humana. No carga automáticamente en SAP ni se integra con SAP en tiempo real. No interviene durante el mes de vigencia del móvil, o sea que no hace seguimiento de cumplimiento. No incorpora herramientas de apoyo a la gestión comercial. Y no evalúa si el objetivo asignado es alcanzable o razonable.

El beneficio esperado, medido en el propio documento del cliente, es bajar el tiempo de armado mensual de cuatro o cinco horas a un rango de treinta a cuarenta y cinco minutos, estandarizar criterios entre negocios, y dejar rastro de cómo se llegó a cada número.

## Parte 8. Lo que todavía hay que definir

Hay puntos abiertos que condicionan la arquitectura y que conviene cerrar antes de escribir código.

El más importante es la profundidad de apertura por canal. Si cada canal puede abrirse a distinta profundidad, como sugiere fuertemente la estructura del archivo, entonces el modelo de datos no puede ser una cadena fija de cuatro niveles, tiene que ser un árbol de profundidad variable. Esa decisión afecta absolutamente todo lo demás.

Después está la existencia real del nivel territorio, que como se dijo no aparece en ningún lado del archivo.

Está el alcance de la integración con SAP: si se genera el archivo de carga o si eso queda como trabajo futuro.

Está el alcance geográfico y de negocio: si la prueba de concepto se acota a un solo negocio en un solo país, o si tiene que contemplar varios desde el arranque.

Está el tratamiento de las entidades sin histórico. Un producto nuevo, uno discontinuado, uno sin movimiento en el período: el motor tiene que resolver explícitamente qué hacer con ellos antes de aplicar un reparto basado en participaciones, porque no hay porcentaje que calcular.

Y está una pregunta sobre la memoria del sistema: cuando se archiva un móvil aprobado, ¿se guarda solamente el resultado, o también los parámetros y reglas que estaban vigentes cuando se calculó? Si se guarda solo el resultado, el histórico pierde valor apenas cambia el contexto, porque nadie va a saber bajo qué supuestos se armó.

## Parte 9. Cómo se organiza el trabajo

El equipo propuso dividir los tres meses en tres fases.

Septiembre es definición: cerrar los puntos abiertos, relevar las reglas reales que hoy están en la cabeza de las personas, y validar el modelo de datos y el entorno técnico.

Octubre es construcción: el motor de distribución en cascada con recálculo, la base de cálculo configurable, la gestión de excepciones y la validación de cuadratura.

Noviembre es validación y entrega: pruebas con datos reales, ajustes, documentación y entrega.

La razón de tener una fase de definición explícita antes de construir es evitar el desvío de alcance que el propio cliente señaló como problema en desarrollos anteriores.
