"""
Dónde vive el móvil de cada mes. Un móvil por mes, compartido por todos los planners.

Sin almacén, en memoria: se pierde al reiniciar (desarrollo sin Docker, tests). Con
almacén, cada acción que sale bien se guarda (ver `almacen.py`) y un mes se reconstruye
la primera vez que se lo pide. La interfaz para las rutas: `usar(mes)`, un context manager
que da el móvil con acceso exclusivo.
"""

from __future__ import annotations

import threading
from contextlib import contextmanager
from datetime import date, datetime
from io import BytesIO
from pathlib import Path
from typing import Callable, Iterator

from src.movil.almacen import Almacen
from src.movil.sesion import ErrorDeAjuste, Sesion

class MesInexistente(LookupError):
    pass


class Repositorio:
    """
    Un lock global serializa los pedidos: alcanza para ~20 planners editando a mano.
    ponytail: un solo proceso; con varios workers cada uno tendría su copia en memoria.
    """

    def __init__(self, almacen: Almacen | None = None, hoy: Callable[[], date] = date.today):
        self._almacen = almacen
        self._hoy = hoy
        self._sesiones: dict[str, Sesion] = {}
        # Lock común, no RLock: FastAPI toma y suelta el móvil (la dependencia) en hilos distintos.
        self._lock = threading.Lock()

    @contextmanager
    def usar(self, mes: str | None = None) -> Iterator[Sesion]:
        """El móvil de `mes` ("2026-10"); sin mes, el último. Si no hay ninguno, arranca el del mes actual."""
        with self._lock:
            meses = self._meses()
            if mes is None:
                mes = meses[-1] if meses else self._hoy().strftime("%Y-%m")
                if not meses:
                    self._crear(mes)
            elif mes not in meses:
                raise MesInexistente(f"No hay un móvil de {mes}.")
            sesion = self._sesion(mes)
            sesion.es_ultimo = not meses or mes == meses[-1]
            yield _Grabadora(sesion, self, mes)

    def meses(self) -> list[dict]:
        """
        Cada móvil con su estado, del más viejo al más nuevo.
        ponytail: reconstruye cada mes la primera vez después de un reinicio (después quedan en
        memoria); con muchos meses, guardar el estado de aprobación en la tabla movil.
        """
        with self._lock:
            return [{"mes": m, "aprobado": self._sesion(m).aprobado} for m in self._meses()]

    def empezar_siguiente(self, autor: str, cuando: datetime) -> str:
        """El mes siguiente arranca del último aprobado: su reparto es la base, y se heredan reglas y ajustes."""
        with self._lock:
            meses = self._meses()
            if not meses:
                raise ErrorDeAjuste("Todavía no hay ningún móvil: cargá el del mes actual.")
            ultimo = meses[-1]
            anterior = self._sesion(ultimo)
            if anterior.aprobado is None:
                raise ErrorDeAjuste(f"Para empezar el mes siguiente, primero aprobá el móvil de {ultimo}.")
            # La foto antes de crear el mes: si falla, no queda un mes vacío.
            foto, nuevo = anterior.foto(), mes_siguiente(ultimo)
            self._crear(nuevo)
            _Grabadora(self._sesion(nuevo), self, nuevo).heredar(foto, ultimo, autor, cuando)
            return nuevo

    def reiniciar(self) -> None:
        """Borra todos los meses: el próximo pedido arranca el mes actual, vacío. Solo para practicar en local."""
        with self._lock:
            if self._almacen:
                self._almacen.borrar_todo()
            self._sesiones.clear()

    # --- interno ------------------------------------------------------------

    def _meses(self) -> list[str]:
        return self._almacen.meses() if self._almacen else sorted(self._sesiones)

    def _crear(self, mes: str) -> None:
        if self._almacen:
            self._almacen.crear_mes(mes)
        self._sesiones[mes] = Sesion()

    def _sesion(self, mes: str) -> Sesion:
        if mes not in self._sesiones:
            self._sesiones[mes] = self._reconstruir(mes)
        return self._sesiones[mes]

    def _reconstruir(self, mes: str) -> Sesion:
        s = Sesion()
        s.diferir = True  # se recalcula una vez, al final, no en cada acción
        for id_, metodo, guardado in self._almacen.comandos(mes):
            args = _decodificar(guardado, self._almacen.archivos(id_))
            getattr(s, metodo)(*args["args"], **args["kwargs"])
        s.diferir = False
        return s

    def _registrar(self, mes: str, metodo: str, args: tuple, kwargs: dict) -> None:
        if not self._almacen:
            return
        archivos: list[bytes] = []
        guardado = _codificar({"args": list(args), "kwargs": kwargs}, archivos)
        try:
            self._almacen.guardar(mes, metodo, guardado, archivos)
        except Exception:
            # La acción ya se aplicó en memoria pero no quedó guardada: se descarta la copia en memoria
            # para que el próximo pedido la reconstruya desde lo guardado, sin esta acción.
            self._sesiones.pop(mes, None)
            raise


class _Grabadora:
    """
    El móvil, tal cual, salvo que cada acción que sale bien queda guardada. Una acción es
    lo que deja una entrada en el historial: no hay que mantener una lista.
    """

    def __init__(self, sesion: Sesion, repositorio: Repositorio, mes: str):
        self._s, self._r, self.mes = sesion, repositorio, mes

    def __getattr__(self, nombre):
        valor = getattr(self._s, nombre)
        if not callable(valor):
            return valor

        def llamada(*args, **kwargs):
            antes = len(self._s.historial)
            resultado = valor(*args, **kwargs)
            if len(self._s.historial) > antes:
                self._r._registrar(self.mes, nombre, args, kwargs)
            return resultado
        return llamada


def mes_siguiente(mes: str) -> str:
    anio, m = map(int, mes.split("-"))
    return f"{anio + m // 12}-{m % 12 + 1:02d}"


# --- codificación: lo que recibe cada acción, a JSON y de vuelta ----------------

def _codificar(valor, archivos: list[bytes]):
    if isinstance(valor, Path):
        archivos.append(valor.read_bytes())
        return {"__archivo__": len(archivos) - 1}
    if isinstance(valor, BytesIO):
        archivos.append(valor.getvalue())
        return {"__archivo__": len(archivos) - 1}
    if isinstance(valor, datetime):
        return {"__fecha__": valor.isoformat()}
    if isinstance(valor, dict):
        return {k: _codificar(v, archivos) for k, v in valor.items()}
    if isinstance(valor, (list, tuple)):
        return [_codificar(v, archivos) for v in valor]
    return valor


def _decodificar(valor, archivos: list[bytes]):
    if isinstance(valor, dict):
        if set(valor) == {"__archivo__"}:
            return BytesIO(archivos[valor["__archivo__"]])
        if set(valor) == {"__fecha__"}:
            return datetime.fromisoformat(valor["__fecha__"])
        return {k: _decodificar(v, archivos) for k, v in valor.items()}
    if isinstance(valor, list):
        return [_decodificar(v, archivos) for v in valor]
    return valor
