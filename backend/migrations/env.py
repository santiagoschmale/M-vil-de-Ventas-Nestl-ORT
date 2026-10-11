"""Alembic: las migraciones corren contra DATABASE_URL, con las tablas de src/movil/almacen.py."""

from os import environ

from alembic import context

from src.movil.almacen import Almacen, metadata

motor = Almacen(environ["DATABASE_URL"]).motor

with motor.connect() as conexion:
    context.configure(connection=conexion, target_metadata=metadata)
    with context.begin_transaction():
        context.run_migrations()
