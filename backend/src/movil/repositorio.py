"""
Dónde vive la sesión del mes. Hoy en memoria; con Postgres se agrega otra
implementación de la misma interfaz y ni el dominio ni las rutas se enteran. La
interfaz: `usar()`, un context manager que da la sesión con acceso exclusivo.
"""

import threading
from contextlib import contextmanager
from typing import Iterator

from src.movil.sesion import Sesion


class RepositorioEnMemoria:
    """
    Una única sesión compartida. Se pierde al reiniciar el backend.
    Un lock global serializa los pedidos: alcanza para ~20 planners editando a mano;
    con Postgres la concurrencia pasa a la base.
    """

    def __init__(self):
        self._sesion = Sesion()
        self._lock = threading.Lock()

    @contextmanager
    def usar(self) -> Iterator[Sesion]:
        with self._lock:
            yield self._sesion
