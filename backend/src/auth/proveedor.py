"""
Autenticación detrás de una interfaz: el resto del sistema pregunta quién es el
usuario y no sabe de dónde sale. Hoy hay un proveedor local que devuelve
`planner-local`. Cuando IT habilite Entra ID, se agrega otro proveedor con la
misma interfaz y se cambia en app.py. La interfaz: `usuario_actual(request) -> str`.
"""

from fastapi import Request


class ProveedorLocal:
    """Desarrollo local: sin login, un único planner."""

    def usuario_actual(self, request: Request) -> str:
        return "planner-local"
