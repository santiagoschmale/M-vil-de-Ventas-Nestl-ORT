from sqlalchemy import BigInteger, Boolean, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

# Mapeo de solo-lectura/escritura sobre tablas que ya crea Prisma
# (packages/db/prisma/schema.prisma). Se agregan acá únicamente las
# tablas que necesita el flujo de Excel; para las demás (Territorio,
# Vendedor, Distribuidor, Excepcion, etc.) sumar un modelo nuevo con
# el mismo patrón cuando haga falta.


class Sku(Base):
    __tablename__ = "sku"

    sku_id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(30))
    nombre: Mapped[str] = mapped_column(String(150))


class Canal(Base):
    __tablename__ = "canal"

    canal_id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(60))


class ObjetivoTotal(Base):
    __tablename__ = "objetivo_total"

    objetivo_id: Mapped[int] = mapped_column(primary_key=True)
    sku_id: Mapped[int]
    periodo: Mapped[str] = mapped_column(String(7))
    kilos: Mapped[float] = mapped_column(Numeric(14, 3))
    facturacion: Mapped[float] = mapped_column(Numeric(14, 2))


class Participacion(Base):
    __tablename__ = "participacion"

    participacion_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    sku_id: Mapped[int]
    periodo: Mapped[str] = mapped_column(String(7))
    entidad_tipo: Mapped[str] = mapped_column(String(20))
    entidad_id: Mapped[int]
    porcentaje: Mapped[float] = mapped_column(Numeric(9, 6))
    origen: Mapped[str] = mapped_column(String(20))
    aprobado: Mapped[bool] = mapped_column(Boolean)
