"""Las migraciones dejan la base igual a las tablas del código: si alguien cambia una tabla sin migración, falla."""

from os import environ
from pathlib import Path
from tempfile import TemporaryDirectory

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext

from src.movil.almacen import Almacen, metadata

BACKEND = Path(__file__).parents[2]


def test_las_migraciones_coinciden_con_las_tablas():
    with TemporaryDirectory() as carpeta:
        url = f"sqlite:///{carpeta}/base.db"
        antes, environ["DATABASE_URL"] = environ.get("DATABASE_URL"), url
        try:
            config = Config(str(BACKEND / "alembic.ini"))
            config.set_main_option("script_location", str(BACKEND / "migrations"))
            command.upgrade(config, "head")
        finally:
            if antes is None:
                environ.pop("DATABASE_URL")
            else:
                environ["DATABASE_URL"] = antes
        with Almacen(url).motor.connect() as c:
            assert compare_metadata(MigrationContext.configure(c), metadata) == []
