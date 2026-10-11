"""
Dónde se guarda cada móvil del mes: en PostgreSQL (en los tests, SQLite en memoria).

No se guarda el estado, se guarda lo que hizo el planner: cada acción que salió bien
(cargar un archivo, fijar, apagar, aprobar...) con sus datos, en orden, y los archivos
tal cual se subieron. Un mes se reconstruye volviendo a ejecutar sus acciones. Así el
historial es la fuente de verdad y lo guardado no depende de cómo está armada la sesión
por dentro.
"""

from __future__ import annotations

from sqlalchemy import JSON, Column, ForeignKey, Integer, LargeBinary, MetaData, String, Table, create_engine, insert, \
    select
from sqlalchemy.pool import StaticPool

metadata = MetaData()

movil = Table(
    "movil", metadata,
    Column("mes", String(7), primary_key=True),  # "2026-10"
)

comando = Table(
    "comando", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),  # el orden en que se hicieron
    Column("mes", String(7), ForeignKey("movil.mes"), nullable=False, index=True),
    Column("metodo", String(40), nullable=False),
    Column("args", JSON, nullable=False),  # {"args": [...], "kwargs": {...}}, codificados por el repositorio
)

archivo = Table(
    "archivo", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("contenido", LargeBinary, nullable=False),
)


class Almacen:
    def __init__(self, url: str):
        # "postgresql://..." (como en .env) usa el driver psycopg 3.
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        opciones = {"poolclass": StaticPool, "connect_args": {"check_same_thread": False}} if url == "sqlite://" else {}
        self.motor = create_engine(url, **opciones)

    def crear_tablas(self) -> None:
        """Solo para tests: en Postgres las tablas las crean las migraciones (alembic upgrade head)."""
        metadata.create_all(self.motor)

    def meses(self) -> list[str]:
        with self.motor.connect() as c:
            return sorted(c.scalars(select(movil.c.mes)))

    def crear_mes(self, mes: str) -> None:
        with self.motor.begin() as c:
            c.execute(insert(movil).values(mes=mes))

    def comandos(self, mes: str) -> list[tuple[str, dict]]:
        with self.motor.connect() as c:
            return [(m, a) for m, a in c.execute(
                select(comando.c.metodo, comando.c.args).where(comando.c.mes == mes).order_by(comando.c.id))]

    def guardar(self, mes: str, metodo: str, args: dict, archivos: list[bytes]) -> None:
        """La acción y sus archivos, en una sola transacción. `args` refiere a los archivos por posición."""
        with self.motor.begin() as c:
            ids = [c.execute(insert(archivo).values(contenido=b)).inserted_primary_key[0] for b in archivos]
            c.execute(insert(comando).values(mes=mes, metodo=metodo, args=_con_ids(args, ids)))

    def archivo(self, id_: int) -> bytes:
        with self.motor.connect() as c:
            return c.scalar(select(archivo.c.contenido).where(archivo.c.id == id_))


def _con_ids(valor, ids: list[int]):
    """Reemplaza {"__archivo__": posición} por {"__archivo__": id en la base}."""
    if isinstance(valor, dict):
        if set(valor) == {"__archivo__"}:
            return {"__archivo__": ids[valor["__archivo__"]]}
        return {k: _con_ids(v, ids) for k, v in valor.items()}
    if isinstance(valor, list):
        return [_con_ids(v, ids) for v in valor]
    return valor
