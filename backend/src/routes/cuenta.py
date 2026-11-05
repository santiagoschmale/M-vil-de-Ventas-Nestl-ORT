"""Quién es el usuario y cómo se inicia sesión: lo primero que pide la pantalla."""

from fastapi import APIRouter, Request

router = APIRouter(prefix="/api", tags=["Cuenta"])


@router.get("/config", summary="Cómo inicia sesión la pantalla: con Entra ID (tenant y app) o sin login (desarrollo)")
def config(request: Request):
    return {"entra": request.app.state.autenticacion.entra}


@router.get("/whoami", summary="El usuario de la sesión: nombre, usuario y roles")
def whoami(request: Request):
    return request.app.state.autenticacion.perfil(request)
