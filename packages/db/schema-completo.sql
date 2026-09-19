-- ============================================================
-- MOTOR DEL MÓVIL DE VENTAS — schema completo (Postgres)
--
-- Versión ejecutable de una sola vez, pensada para correr manual
-- contra la base local (docker compose up -d db) sin pasar por
-- Prisma, para levantar rápido un entorno de prueba:
--
--   docker compose up -d db
--   docker compose exec -T db psql -U motor -d motor_distribucion < packages/db/schema-completo.sql
--
-- El schema "de verdad" (el que se versiona con cada cambio) vive en
-- packages/db/prisma/schema.prisma + packages/db/prisma/migrations/.
-- Este archivo es un espejo de esa migración inicial, en un solo
-- lugar fácil de compartir o de correr en cualquier Postgres.
--
-- Detalle tabla por tabla (columnas, relaciones, para qué sirve cada
-- una) en la carpeta packages/db/tablas/.
-- ============================================================

-- ---------- CATÁLOGO BASE ----------

CREATE TABLE "sku" (
    "sku_id"     SERIAL PRIMARY KEY,
    "codigo"     VARCHAR(30) NOT NULL,
    "nombre"     VARCHAR(150) NOT NULL,
    "categoria"  VARCHAR(80),
    "activo"     BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "sku_codigo_key" UNIQUE ("codigo")
);

CREATE TABLE "canal" (
    "canal_id"           SERIAL PRIMARY KEY,
    "nombre"             VARCHAR(60) NOT NULL,
    "profundidad_maxima" VARCHAR(20) NOT NULL DEFAULT 'canal',
    CONSTRAINT "canal_nombre_key" UNIQUE ("nombre")
);
-- valores esperados de profundidad_maxima: 'canal' | 'territorio' | 'vendedor' | 'distribuidor'
-- PROVISORIO (supuesto bloqueante #1, pendiente de confirmación con Nestlé).

CREATE TABLE "territorio" (
    "territorio_id" SERIAL PRIMARY KEY,
    "nombre"        VARCHAR(80) NOT NULL,
    "canal_id"      INTEGER NOT NULL REFERENCES "canal"("canal_id")
);

CREATE TABLE "vendedor" (
    "vendedor_id"   SERIAL PRIMARY KEY,
    "codigo"        VARCHAR(30) NOT NULL,
    "territorio_id" INTEGER NOT NULL REFERENCES "territorio"("territorio_id"),
    "activo"        BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "vendedor_codigo_key" UNIQUE ("codigo")
);

CREATE TABLE "distribuidor" (
    "distribuidor_id" SERIAL PRIMARY KEY,
    "codigo"          VARCHAR(30) NOT NULL,
    "nombre"          VARCHAR(150),
    "activo"          BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "distribuidor_codigo_key" UNIQUE ("codigo")
);

-- ---------- OBJETIVO TOTAL (input de Contraloría) ----------

CREATE TABLE "objetivo_total" (
    "objetivo_id"    SERIAL PRIMARY KEY,
    "sku_id"         INTEGER NOT NULL REFERENCES "sku"("sku_id"),
    "periodo"        CHAR(7) NOT NULL,
    "kilos"          DECIMAL(14,3) NOT NULL,
    "facturacion"    DECIMAL(14,2) NOT NULL,
    "creado_por"     VARCHAR(80),
    "fecha_creacion" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "UQ_ObjetivoTotal" UNIQUE ("sku_id", "periodo")
);

-- ---------- PARTICIPACIÓN (el corazón del reparto en cascada) ----------

CREATE TABLE "participacion" (
    "participacion_id"          BIGSERIAL PRIMARY KEY,
    "sku_id"                    INTEGER NOT NULL REFERENCES "sku"("sku_id"),
    "periodo"                   CHAR(7) NOT NULL,
    "entidad_tipo"               VARCHAR(20) NOT NULL,
    "entidad_id"                 INTEGER NOT NULL,
    "parent_participacion_id"    BIGINT REFERENCES "participacion"("participacion_id"),
    "porcentaje"                 DECIMAL(9,6) NOT NULL,
    "origen"                     VARCHAR(20) NOT NULL,
    "kilos_calculados"           DECIMAL(14,3),
    "aprobado"                   BOOLEAN NOT NULL DEFAULT false,
    "modificado_por"             VARCHAR(80),
    "fecha_modificacion"         TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
-- entidad_id es una FK lógica a canal/territorio/vendedor/distribuidor
-- según entidad_tipo. No se modela como FK real: es polimórfica y se
-- valida en la capa de aplicación (igual que en el diseño original).

CREATE INDEX "IX_Participacion_lookup"
    ON "participacion" ("sku_id", "periodo", "entidad_tipo", "entidad_id");

-- Cuadratura como REGLA, no como columna de control posterior:
-- vista que sirve de base para validar que los hijos de un mismo
-- padre sumen 1 (100%) antes de permitir aprobar la etapa.
CREATE VIEW "vw_CuadraturaPorPadre" AS
SELECT
    "parent_participacion_id",
    "sku_id",
    "periodo",
    SUM("porcentaje") AS "suma_participacion"
FROM "participacion"
WHERE "parent_participacion_id" IS NOT NULL
GROUP BY "parent_participacion_id", "sku_id", "periodo";
-- La aplicación debe bloquear (o alertar) el paso a "aprobado = true"
-- cuando suma_participacion <> 1 dentro de una tolerancia definida.

-- ---------- EXCEPCIONES (habilitar/deshabilitar antes de ejecutar) ----------

CREATE TABLE "excepcion" (
    "excepcion_id"   SERIAL PRIMARY KEY,
    "entidad_tipo"   VARCHAR(20) NOT NULL,
    "entidad_id"     INTEGER NOT NULL,
    "periodo"        CHAR(7) NOT NULL,
    "activo"         BOOLEAN NOT NULL DEFAULT true,
    "motivo"         VARCHAR(200),
    "creado_por"     VARCHAR(80),
    "fecha_creacion" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

-- ---------- HISTÓRICO (con versionado de reglas, no solo resultado) ----------

CREATE TABLE "movil_aprobado" (
    "movil_id"         SERIAL PRIMARY KEY,
    "periodo"          CHAR(7) NOT NULL,
    "aprobado_por"     VARCHAR(80) NOT NULL,
    "fecha_aprobacion" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "snapshot_json"    JSONB NOT NULL,
    CONSTRAINT "movil_aprobado_periodo_key" UNIQUE ("periodo")
);

-- ---------- REGLAS DE NEGOCIO (back office, sin hardcodear) ----------

CREATE TABLE "regla_distribucion" (
    "regla_id"        SERIAL PRIMARY KEY,
    "canal_id"        INTEGER NOT NULL REFERENCES "canal"("canal_id"),
    "nombre"          VARCHAR(120) NOT NULL,
    "tipo"            VARCHAR(30) NOT NULL,
    "parametros_json" JSONB,
    "activo"          BOOLEAN NOT NULL DEFAULT true
);
