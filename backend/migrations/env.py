"""Alembic: las migraciones corren contra DATABASE_URL, con las tablas de src/movil/almacen.py."""

from os import environ

from alembic import context

from src.movil.almacen import Almacen, metadata

if "DATABASE_URL" not in environ:
    raise SystemExit("Falta DATABASE_URL. Ej.: DATABASE_URL=postgresql://motor:motor@localhost:5433/"
                     "motor_distribucion (o usar make db, que la setea).")
motor = Almacen(environ["DATABASE_URL"]).motor

with motor.connect() as conexion:
    context.configure(connection=conexion, target_metadata=metadata)
    with context.begin_transaction():
        context.run_migrations()
