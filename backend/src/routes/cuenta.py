"""Quién es el usuario y cómo se inicia sesión: lo primero que pide la pantalla."""

from os import environ

from fastapi import APIRouter, Request

router = APIRouter(prefix="/api", tags=["Cuenta"])


@router.get("/config", summary="Cómo inicia sesión la pantalla: con Entra ID (tenant y app) o sin login (desarrollo)")
def config(request: Request):
    return {"entra": request.app.state.autenticacion.entra, "reiniciar": puede_reiniciar(request)}


def puede_reiniciar(request: Request) -> bool:
    """Empezar de cero borra todos los meses. Sin Entra (local o el entorno de prueba del cliente) está siempre;
    con Entra, solo si se prende con PERMITIR_REINICIAR=true."""
    if request.app.state.autenticacion.entra is None:
        return True
    return any(environ.get(v, "").lower() == "true" for v in ("IS_LOCAL", "PERMITIR_REINICIAR"))


@router.get("/whoami", summary="El usuario de la sesión: nombre, usuario y roles")
def whoami(request: Request):
    return request.app.state.autenticacion.perfil(request)
