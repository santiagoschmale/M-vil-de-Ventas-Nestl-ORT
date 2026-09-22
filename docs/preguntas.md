# Preguntas pendientes al cliente

POC Distribución del Móvil · Nestlé DIL Región Plata · Universidad ORT

Consolidado de lo que falta definir. Separado por destinatario, porque no todo va
a la misma persona.

---

# Para IT

## Entorno y accesos

**1. Repositorio.** ¿El repo remoto es el mismo template que nos compartieron como
ejemplo, o va a tener diferencias? ¿Cuándo tendríamos acceso?

**2. Librerías internas.** ¿De dónde se instalan las librerías `nbra-*` del backend
y los paquetes del registry de npm del frontend? ¿Hacen falta credenciales, VPN o
estar en la red de Nestlé? Sin esto no podemos ni instalar dependencias.

**3. Entorno sandbox.** ¿Cómo se solicita el acceso y qué demora tiene?

**4. Base de datos.** ¿La instancia de PostgreSQL la proveen ustedes en el sandbox
o la desplegamos nosotros dentro del namespace? Si hay un circuito formal para
solicitarla, nos gustaría iniciarlo temprano para que no frene la construcción.

## Pipeline y calidad

**5. Verificaciones del pipeline.** Entendemos que el pipeline lo declaran ustedes
y que cada merge dispara la construcción de la imagen. ¿Qué verifica exactamente
antes de construir? ¿Impone umbrales de cobertura o de mutation testing que
bloqueen el merge?

**6. Framework de tests.** El template trae nose2. ¿Es obligatorio o podemos usar
pytest? Lo preguntamos porque nose2 está prácticamente discontinuado y para un
equipo que está aprendiendo la diferencia en material de consulta es grande.

**7. Aprobación de cambios.** ¿Quién figura en CODEOWNERS? ¿Nuestros pull requests
los aprueba alguien de Nestlé o los administramos nosotros?

**8. QA.** ¿TestSprite es de uso obligatorio o una sugerencia?

## Autenticación

**9. Entra ID.** Para la autenticación necesitaríamos un app registration en el
tenant: client ID, tenant ID, secret y redirect URIs por ambiente. Más definir cómo
accedemos nosotros siendo externos con cuenta institucional de ORT.

¿Qué tan factible es tenerlo resuelto en las próximas semanas y qué circuito hay
que iniciar? Si no es viable en ese plazo, lo tenemos en cuenta para la
planificación.

## Estructura del proyecto

**10. Persistencia.** El scaffold no incluye capa de base de datos: no trae
modelos, migraciones ni ORM. ¿Existe un estándar de Nestlé que debamos adoptar, o
lo definimos nosotros?

---

# Para negocio

## Bloqueante para el motor

**11. Criterio de redistribución.** Cuando se deshabilita una entidad o se modifica
un SKU, la parte que le correspondía se reparte entre las que quedan. ¿Con qué
criterio? ¿Proporcional al peso de cada una, o en partes iguales?

Es el mismo criterio para los dos casos y es la única regla del alcance obligatorio
que todavía no está definida.

## Valorización

**12. Kilos y facturación.** ¿La facturación se reparte junto con los kilos, o los
kilos son el dato principal y la facturación se deriva?

**13. Lista de precios.** Comparando el precio implícito por kilo del móvil de mayo
contra el histórico 2025, la diferencia no es uniforme: varía según el producto.
Eso sugiere que se aplica una lista de precios que no está en el archivo
compartido.

¿El móvil llega ya valorizado desde Contraloría, o el sistema tiene que
valorizarlo? Si tiene que valorizarlo, ¿cuál es la fuente de la lista y con qué
vigencia?

**14. Prioridad al ajustar.** Cuando el planner ajusta un valor a mano, ¿qué unidad
manda, los kilos o la facturación?

## Datos y reglas

**15. Entidades sin histórico.** Un SKU nuevo, o uno estacional sin venta en el
período: no hay participación que calcular. ¿Qué debería hacer el sistema?

**16. Identidad del vendedor.** En el archivo hay columnas de vendedor que se
repiten con un sufijo distinto, que parece indicar el sistema de origen del dato.
¿La entidad que recibe el móvil es la persona, o la combinación de persona y
sistema?

**17. Origen del histórico.** La base de cálculo del mes siguiente, ¿se alimenta de
la venta real o de los móviles asignados?

**18. Apertura futura.** ¿Un canal que hoy cierra a nivel canal podría necesitar
abrirse por vendedor más adelante? Lo preguntamos porque la arquitectura ya lo
contempla y queremos confirmar que tiene sentido.

## Roles

**19. Perfiles de usuario.** ¿Los roles y permisos vienen de grupos de Entra, o los
administramos nosotros dentro del sistema? ¿Cuántos perfiles distintos hay, más
allá del planner?

---

# Pedidos pendientes

| Qué | Estado |
|---|---|
| Ejemplos de reglas de negocio vigentes | Prometidos en la reunión |
| Sesión de observación del armado del móvil | Pendiente de fecha |
| Documentación adicional prometida por el cliente | Prometida |
| Archivo de referencia anonimizado | El compartido incluye nombres de vendedores y razones sociales |

> **La sesión de observación es la más importante de las cuatro.** Buena parte del
> criterio de distribución no está documentado, y los ejemplos escritos no
> reemplazan ver el proceso en vivo y poder preguntar por qué se toma cada decisión.

---

# Cómo impacta cada respuesta

| Pregunta | Qué condiciona |
|---|---|
| 2, 3, 4 | Cuándo podemos empezar a construir sobre la infraestructura real |
| 5, 6, 7 | El ritmo de trabajo y cuánto esfuerzo va a testing |
| 9 | Si la autenticación corporativa entra en el alcance de la POC |
| 11 | El motor de distribución, que es el núcleo obligatorio |
| 12, 13, 14 | Si la valorización es una etapa del sistema o un dato de entrada |
| 15, 16 | El modelo de datos |
| 19 | Si hace falta administración de usuarios dentro del sistema |
