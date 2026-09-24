# Reemplazos locales de las librerías `nbra-*`

Las librerías internas de Nestlé (`nbra-logger-py`, `nbra-envs-python`) se
instalan desde un índice privado al que todavía no tenemos acceso. Para poder
desarrollar y testear, estos paquetes exponen **la misma interfaz que usa el
código** con implementaciones mínimas:

| Paquete | Qué hace acá | Qué hace el real (a confirmar con IT) |
|---|---|---|
| `nbra_logger.build_nbra_logger(application_name)` | Logger estándar de Python a stdout | Logger con el formato de la plataforma |
| `nbra_envs_python.set_local_variables()` | No hace nada (las variables salen del entorno) | Carga variables de entorno/secretos de la plataforma |

`requirements.txt` no se toca: sigue pidiendo los paquetes reales, que es lo que
instala el pipeline de Nestlé. En local se usa `make deps-local`, que instala
todo menos las `nbra-*` y pone estos reemplazos en su lugar.

**Nunca instalar las `nbra-*` desde el índice público.** Hoy no existen en PyPI;
si alguien registrara esos nombres, un `pip install -r requirements.txt` contra
PyPI instalaría código ajeno (dependency confusion).

Cuando haya acceso al índice privado, se borra esta carpeta y el target
`deps-local`.
