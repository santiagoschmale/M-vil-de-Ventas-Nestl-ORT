# Alcance funcional — POC Distribución del Móvil

Nestlé DIL Región Plata · Universidad ORT

Organización del trabajo por épicas. Cada épica agrupa tareas que entregan una
capacidad completa del sistema.

---

## A · Motor de reparto

El núcleo de cálculo. Reparte un total entre entidades garantizando que la suma
cierre exacto. No sabe nada de base de datos, de API ni de Nestlé: recibe números
y devuelve números.

- Reparto de un total entre entidades por participación
- Reparto de restos con largest remainder, para que la suma cierre exacta
- Cálculo con Decimal en todos los montos, kilos y facturación
- Validación de cuadratura contra el nivel superior
- Rechazo de entradas inválidas: participaciones negativas, conjunto vacío, todos los pesos en cero
- Reparto en paralelo de las dos unidades, kilos y facturación, cada una cuadrando por separado

**Entrega:** un módulo que reparte cualquier total sin perder unidades, con tests.

---

## B · Estructura de la distribución

El árbol sobre el que opera el motor. Es la decisión de modelado que más impacta
al resto.

- Árbol de profundidad variable: cada canal define hasta dónde se abre
- Nodos con valor y estado: calculado o editado a mano
- Base SKU-canal: qué canales aplican a cada producto
- Distinción entre "no aplica" y "aplica con cero"
- Recorrido de la cascada completa, nivel por nivel

**Entrega:** la estructura que representa un móvil abierto, con la asimetría real
entre canales.

---

## C · Lectura del archivo de entrada

Traer los datos reales al sistema.

> **Excel es la única superficie de integración.** Entra un Excel con el objetivo
> del mes y el histórico de participaciones, sale un Excel con el móvil abierto.
> No hay conexión con SAP ni con ningún otro sistema. El circuito posterior (carga en SAP por el equipo de servicios) sigue
> funcionando como hoy y queda fuera del alcance.

- Lectura del objetivo mensual por SKU: kilos, NNS, NNS con IIBB
- Lectura de los cuatro bloques de participaciones, cada uno con su dimensión
- Detección de columnas por nombre de encabezado, no por posición
- Validación de calidad: participaciones negativas, controles que no cierran, SKUs sin correspondencia entre hojas
- Normalización de catálogo: categorías escritas distinto, productos de otros países
- Generación de un dataset de prueba anonimizado

**Entrega:** el archivo de mayo cargado y validado, con los problemas de datos
reportados en vez de replicados.

---

## D · Recorrido end-to-end

La primera integración: importar, repartir, cuadrar, exportar. Sin interfaz, sin
base, sin autenticación.

- Encadenar lectura, reparto en cascada y verificación de cuadratura
- Salida del resultado en formato legible
- Corrida completa sobre datos reales

**Entrega:** el hito que confirma que la lógica funciona antes de construir todo
lo demás alrededor. Si esto no corre, hay un problema de fondo.

---

## E · Persistencia

Base de datos propia del sistema. Guarda el trabajo del planner y el histórico
de móviles.

- Modelo relacional: móvil, nodos, entidades, participaciones, base SKU-canal
- Migraciones versionadas desde el primer día
- Guardar y recuperar un móvil completo con su estado
- Estados del móvil: en armado, aprobado, vigente, histórico
- Estado intermedio: el planner puede dejar un móvil a medio armar y retomarlo

**Entrega:** un móvil sobrevive a cerrar el navegador y a reiniciar el sistema.

> **Por qué hace falta.** El cliente pidió guardar cada móvil aprobado, conservar
> cómo quedó abierto el reparto y registrar la intervención humana. Son datos que
> viven entre un mes y el siguiente. Además hay ~20 usuarios concurrentes que
> necesitan ver el mismo estado.

> **Pendiente de definición.** Si la instancia de PostgreSQL la provee Nestlé en el
> entorno sandbox o la desplegamos nosotros dentro del namespace. Si hay un
> circuito formal para solicitarla, conviene iniciarlo temprano. En desarrollo
> local se trabaja con PostgreSQL en contenedor, y el código no distingue entre
> una y otra.

---

## F · API

- Contratos de endpoints definidos y documentados
- Importar archivo
- Ejecutar el reparto y devolver el árbol por etapa
- Editar un nodo
- Aprobar el móvil
- Exportar

**Entrega:** el motor disponible por HTTP. Definir los contratos temprano permite
que el front avance contra mocks sin esperar al backend.

---

## G · Revisión y edición de la cascada

El MUST central del proyecto y donde el planner pasa su tiempo.

- Vista del árbol por etapa, con densidad de información tipo planilla
- Edición de valores en línea
- Recálculo de las etapas siguientes al editar una
- Fijado de valores editados para que el recálculo no los pise
- Indicador de cuadratura por nivel, visible en todo momento
- Visualización de qué valores son calculados y cuáles fueron tocados a mano

**Entrega:** el planner puede revisar y ajustar cada etapa con control sobre lo
que se mueve y lo que no.

---

## H · Excepciones y base de cálculo

Las capacidades nuevas que pidió el cliente respecto del brief original.

- Habilitar y deshabilitar entidades antes de ejecutar el reparto
- Redistribución de la parte de una entidad deshabilitada entre las restantes
- Habilitar y deshabilitar SKUs
- Re-normalización cuando cambia el conjunto de entidades activas
- Selección de base de cálculo por entidad: histórico o porcentaje manual
- Manejo de entidades sin histórico

**Entrega:** el planner resuelve los casos reales que hoy arregla a mano en el Excel.

---

## I · Cierre del ciclo

- Aprobación explícita del móvil, con validación de cuadratura
- Exportación a Excel compatible con el proceso actual
- Almacenamiento del móvil aprobado como histórico
- Registro de la intervención humana: quién editó qué

**Entrega:** el ciclo mensual completo, desde el archivo de entrada hasta el Excel
que baja al equipo comercial.

---

## J · Autenticación y acceso

- Interfaz de autenticación con proveedor local para desarrollo
- Roles y permisos
- Integración con Entra ID, sujeta a factibilidad

**Entrega:** el sistema distingue quién es cada usuario y qué puede hacer.

> **Entra ID depende de IT de Nestlé.** Requiere un app registration en su tenant y
> definir el acceso de usuarios externos. Está consultada la factibilidad y el
> plazo. La autenticación va detrás de una interfaz desde el primer día, así el
> resto del sistema no depende de esa respuesta. Cuánto se invierte en el
> proveedor local (login propio, administración de usuarios) se decide cuando IT
> conteste.

---

## K · Entorno de pruebas y calidad

Transversal. El cliente lo pidió explícitamente: quieren entrar a probar por su
cuenta, no ver demos guiadas.

**El pipeline lo declara Nestlé**, no el equipo. Cada merge lo dispara, se
construye una imagen de Docker y ArgoCD sincroniza el entorno. No se despliega
como acción aparte: se despliega al mergear.

Lo que sí depende del equipo:

- Conocer qué verifica el pipeline y con qué umbrales
- Poder correr esas mismas verificaciones localmente antes de subir cambios
- Escribir los tests que el pipeline espera encontrar
- Datos de demostración cargados en el entorno
- Señalización visible de lo que está a medio hacer
- Tests de integración del flujo completo

**Entrega:** un ambiente donde el cliente prueba cuando quiere, con lo publicado
funcionando de verdad aunque haga poco.

> **Consecuencia directa del flujo.** Si un cambio roto llega a la rama principal,
> llega al entorno que el cliente usa. La disciplina de no mergear sin verificar es
> lo que protege el pedido del cliente.

> **Pendiente de definición.** Qué verifica exactamente el workflow de plataforma,
> si impone umbrales de cobertura o de mutation testing que bloqueen el merge, si
> la rama principal está protegida y quién aprueba los cambios. Todo eso condiciona
> el ritmo de trabajo y no es negociable desde nuestro lado.

---

## L · Documentación y entrega

- Documentación técnica: arquitectura y justificación de las decisiones de diseño
- Documentación funcional y manual de uso
- Preparación de la defensa

---

## Fuera del alcance comprometido

No se aborda ninguna de estas hasta que todo lo anterior esté funcionando.

| | |
|---|---|
| Simulación de escenarios | SHOULD |
| Back office de administración de reglas | SHOULD |
| Dashboard de visualización | COULD |
| Template de carga para SAP | COULD |
| Cargas y ediciones masivas | COULD |
| Multi-país y multi-negocio | COULD |

Explícitamente fuera: reemplazo de la validación comercial humana, carga
automática a SAP, integración con SAP en tiempo real, seguimiento durante el mes
de vigencia, versión mobile, IA y machine learning.

---

## Dependencias externas

Trabajo que no puede avanzar sin definiciones o accesos de Nestlé.

| Dependencia | Épicas que bloquea |
|---|---|
| Credenciales del índice privado de librerías | E, F, J, K |
| Repositorio remoto y accesos | Todas, para trabajo colaborativo |
| Registro de la aplicación en Entra | J (parcialmente, mitigable) |
| Acceso al entorno sandbox | K |
| Instancia de PostgreSQL: ¿la proveen o la desplegamos? | E, K |
| Umbrales de calidad del pipeline y aprobación de cambios | K |
| Ejemplos de reglas de negocio vigentes | H |
| Sesión de observación del proceso actual | G, H |
| Criterio de redistribución al deshabilitar una entidad | H |
| Archivo anonimizado | C |

**A, B, C y D no dependen de nada externo.**
