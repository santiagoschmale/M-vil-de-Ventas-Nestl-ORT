-- ============================================================
-- MOTOR DEL MÓVIL DE VENTAS — schema completo (SQL Server)
--
-- Mismo modelo que packages/db/schema-completo.sql (Postgres), en
-- T-SQL — para quien prefiera levantar SQL Server local en vez de
-- Postgres (se parece más a lo que va a haber en Azure SQL).
--
-- Cómo correrlo con Docker (sin instalar SQL Server local):
--
--   docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=Motor_2026!" \
--     -p 1433:1433 --name motor-distribucion-mssql \
--     -d mcr.microsoft.com/mssql/server:2022-latest
--
--   docker exec -i motor-distribucion-mssql \
--     /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P 'Motor_2026!' \
--     -d master -Q "CREATE DATABASE motor_distribucion"
--
--   docker exec -i motor-distribucion-mssql \
--     /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P 'Motor_2026!' \
--     -d motor_distribucion < packages/db/schema-completo.mssql.sql
--
-- Detalle tabla por tabla en packages/db/tablas/ (nombres de columna
-- son los mismos, solo cambian los tipos T-SQL vs Postgres).
--
-- OJO: la app (Prisma, apps/api, apps/excel-service) está armada
-- para Postgres. Esta variante es para levantar rápido una base de
-- referencia o comparar contra Azure SQL — no la usa el código todavía.
-- ============================================================

-- ---------- CATÁLOGO BASE ----------

CREATE TABLE SKU (
    sku_id          INT IDENTITY PRIMARY KEY,
    codigo          VARCHAR(30) NOT NULL UNIQUE,
    nombre          VARCHAR(150) NOT NULL,
    categoria       VARCHAR(80),
    activo          BIT NOT NULL DEFAULT 1
);

CREATE TABLE Canal (
    canal_id        INT IDENTITY PRIMARY KEY,
    nombre          VARCHAR(60) NOT NULL UNIQUE   -- Catering, Vending, Mayoristas, KAM, Soluciones
);

-- PROVISORIO: profundidad de apertura por canal (supuesto bloqueante #1).
-- Este campo permite que el motor sepa hasta qué nivel baja cada canal
-- sin tener que cambiar el modelo cuando llegue la respuesta.
ALTER TABLE Canal ADD profundidad_maxima VARCHAR(20) NOT NULL DEFAULT 'canal';
    -- valores esperados: 'canal' | 'territorio' | 'vendedor' | 'distribuidor'

CREATE TABLE Territorio (
    territorio_id   INT IDENTITY PRIMARY KEY,
    nombre          VARCHAR(80) NOT NULL,
    canal_id        INT NOT NULL REFERENCES Canal(canal_id)
);

CREATE TABLE Vendedor (
    vendedor_id     INT IDENTITY PRIMARY KEY,
    codigo          VARCHAR(30) NOT NULL UNIQUE,   -- anonimizable (A/B/C) según acuerdo con Nestlé
    territorio_id   INT NOT NULL REFERENCES Territorio(territorio_id),
    activo          BIT NOT NULL DEFAULT 1
);

CREATE TABLE Distribuidor (
    distribuidor_id INT IDENTITY PRIMARY KEY,
    codigo          VARCHAR(30) NOT NULL UNIQUE,
    nombre          VARCHAR(150),
    activo          BIT NOT NULL DEFAULT 1
);

-- ---------- OBJETIVO TOTAL (input de Contraloría) ----------

CREATE TABLE ObjetivoTotal (
    objetivo_id     INT IDENTITY PRIMARY KEY,
    sku_id          INT NOT NULL REFERENCES SKU(sku_id),
    periodo         CHAR(7) NOT NULL,              -- formato 'YYYY-MM'
    kilos           DECIMAL(14,3) NOT NULL,
    facturacion     DECIMAL(14,2) NOT NULL,
    creado_por      VARCHAR(80),                   -- Contraloría
    fecha_creacion  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_ObjetivoTotal UNIQUE (sku_id, periodo)
);

-- ---------- PARTICIPACIÓN (el corazón del reparto en cascada) ----------
-- Modelo genérico: no hay una tabla por nivel, hay un tipo de entidad
-- + un parent_id. Esto es lo que permite que la cascada tenga
-- profundidad variable por canal sin rediseñar nada.

CREATE TABLE Participacion (
    participacion_id   BIGINT IDENTITY PRIMARY KEY,
    sku_id              INT NOT NULL REFERENCES SKU(sku_id),
    periodo             CHAR(7) NOT NULL,
    entidad_tipo        VARCHAR(20) NOT NULL,      -- 'canal' | 'territorio' | 'vendedor' | 'distribuidor'
    entidad_id          INT NOT NULL,               -- FK lógica a Canal/Territorio/Vendedor/Distribuidor según entidad_tipo
    parent_participacion_id BIGINT NULL REFERENCES Participacion(participacion_id),
    porcentaje          DECIMAL(9,6) NOT NULL,      -- ej: 0.103000 = 10.3%
    origen              VARCHAR(20) NOT NULL,       -- 'historico' | 'manual'
    kilos_calculados     DECIMAL(14,3) NULL,        -- resultado ya aplicado sobre el nivel padre
    aprobado             BIT NOT NULL DEFAULT 0,
    modificado_por        VARCHAR(80),
    fecha_modificacion    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_Participacion_lookup
    ON Participacion (sku_id, periodo, entidad_tipo, entidad_id);

-- Cuadratura como REGLA, no como columna de control posterior:
-- vista que sirve de base para validar que los hijos de un mismo
-- padre sumen 1 (100%) antes de permitir aprobar la etapa.
CREATE VIEW vw_CuadraturaPorPadre AS
SELECT
    parent_participacion_id,
    sku_id,
    periodo,
    SUM(porcentaje) AS suma_participacion
FROM Participacion
WHERE parent_participacion_id IS NOT NULL
GROUP BY parent_participacion_id, sku_id, periodo;
-- La aplicación debe bloquear (o alertar) el paso a "aprobado = 1"
-- cuando suma_participacion <> 1 dentro de una tolerancia definida.

-- ---------- EXCEPCIONES (habilitar/deshabilitar antes de ejecutar) ----------

CREATE TABLE Excepcion (
    excepcion_id    INT IDENTITY PRIMARY KEY,
    entidad_tipo    VARCHAR(20) NOT NULL,          -- 'sku' | 'vendedor' | 'distribuidor'
    entidad_id      INT NOT NULL,
    periodo         CHAR(7) NOT NULL,
    activo          BIT NOT NULL DEFAULT 1,        -- 0 = deshabilitado para este período
    motivo          VARCHAR(200),
    creado_por      VARCHAR(80),
    fecha_creacion  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- ---------- HISTÓRICO (con versionado de reglas, no solo resultado) ----------
-- Guarda el snapshot completo del período aprobado, no solo el número final.

CREATE TABLE MovilAprobado (
    movil_id        INT IDENTITY PRIMARY KEY,
    periodo         CHAR(7) NOT NULL UNIQUE,
    aprobado_por    VARCHAR(80) NOT NULL,          -- Sales Planning Lead
    fecha_aprobacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    snapshot_json   NVARCHAR(MAX) NOT NULL         -- copia completa de Participacion + reglas vigentes ese mes
);

-- ---------- REGLAS DE NEGOCIO (back office, sin hardcodear) ----------
-- PROVISORIO: estructura mínima hasta tener ejemplos reales de reglas
-- por canal (punto pendiente con Fernanda).

CREATE TABLE ReglaDistribucion (
    regla_id        INT IDENTITY PRIMARY KEY,
    canal_id        INT NOT NULL REFERENCES Canal(canal_id),
    nombre          VARCHAR(120) NOT NULL,
    tipo            VARCHAR(30) NOT NULL,          -- 'tope' | 'estacional' | 'base_calculo' | otro (a definir)
    parametros_json NVARCHAR(MAX),                 -- flexible hasta conocer la forma real de las reglas
    activo          BIT NOT NULL DEFAULT 1
);
