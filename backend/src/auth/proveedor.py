"""
Autenticación detrás de una interfaz: el resto del sistema pregunta quién es el
usuario y no sabe de dónde sale. Dos proveedores con la misma interfaz:

- `ProveedorLocal`: desarrollo, sin login; un único planner de prueba.
- `ProveedorEntra`: Microsoft Entra ID. El front inicia sesión con Microsoft y manda el
  token en cada pedido (`Authorization: Bearer …`); acá se valida la firma, el emisor
  (el tenant de Nestlé), el destinatario (nuestra app) y que el usuario tenga un rol.

app.py elige: con ENTRA_TENANT_ID y ENTRA_CLIENT_ID, Entra; sin ellas, local.
La interfaz: `usuario_actual(request) -> str` (para el historial) y `perfil(request) -> dict`.
"""

from __future__ import annotations

from fastapi import HTTPException, Request


class ProveedorLocal:
    """Desarrollo local: sin login, un único planner."""

    entra = None

    def usuario_actual(self, request: Request) -> str:
        return "planner-local"

    def perfil(self, request: Request) -> dict:
        # "Apellido,Nombre", como lo manda Nestlé: el front lo da vuelta.
        return {"name": "Prueba,Usuario", "username": "usuario-prueba", "roles": ["Admin"]}


class ProveedorEntra:
    """
    Valida el token de Entra ID de cada pedido. Las claves públicas de Microsoft se bajan y
    se cachean (PyJWKClient). Roles: los "app roles" que IT define en el registro de la app.
    """

    def __init__(self, tenant: str, client_id: str, roles: tuple[str, ...] = ("Planner", "Admin"), claves=None):
        import jwt

        self._jwt = jwt
        self.entra = {"tenant": tenant, "client_id": client_id}
        self._roles = set(roles)
        # Tokens v2 (el emisor termina en /v2.0) y v1 (sts.windows.net): según cómo esté el manifiesto de la app.
        self._emisores = [f"https://login.microsoftonline.com/{tenant}/v2.0", f"https://sts.windows.net/{tenant}/"]
        self._destinatarios = [client_id, f"api://{client_id}"]
        self._claves = claves or jwt.PyJWKClient(f"https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys")

    def _claims(self, request: Request) -> dict:
        encabezado = request.headers.get("authorization", "")
        if not encabezado.lower().startswith("bearer "):
            raise HTTPException(401, "Iniciá sesión con tu cuenta de Nestlé para usar el móvil.")
        token = encabezado[7:].strip()
        try:
            clave = self._claves.get_signing_key_from_jwt(token).key
            claims = self._jwt.decode(token, clave, algorithms=["RS256"], audience=self._destinatarios,
                                      options={"require": ["exp", "iss", "aud"]})
        except self._jwt.PyJWTError as e:
            raise HTTPException(401, "Tu sesión venció o no es válida: volvé a iniciar sesión.") from e
        if claims.get("iss") not in self._emisores:
            raise HTTPException(401, "La sesión es de otra organización: iniciá sesión con tu cuenta de Nestlé.")
        if self._roles and not self._roles & set(claims.get("roles", [])):
            raise HTTPException(403, "Tu usuario no tiene acceso al móvil: pedile a IT el rol Planner.")
        return claims

    def usuario_actual(self, request: Request) -> str:
        c = self._claims(request)
        return c.get("preferred_username") or c.get("upn") or c.get("email") or c["oid"]

    def perfil(self, request: Request) -> dict:
        c = self._claims(request)
        usuario = c.get("preferred_username") or c.get("upn") or c.get("email") or c["oid"]
        return {"name": c.get("name") or usuario, "username": usuario, "roles": list(c.get("roles", []))}
