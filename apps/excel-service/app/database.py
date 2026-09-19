import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Mismo Postgres que usa @motor/db (Prisma) — ver ../../.env.
# Este servicio NO corre migraciones: las tablas ya existen porque
# Prisma es el dueño del schema (packages/db). Acá solo leemos/escribimos
# filas sobre tablas ya creadas.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://motor:motor@localhost:5432/motor_distribucion",
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
