# Motor del Móvil de Ventas — entorno local

Implementación del motor de distribución de objetivos de venta (Nestlé × ORT).
Monorepo Node/Express + React + TypeScript + Prisma/Postgres.

## Estructura

```
apps/
  web/            React + Vite + TS — front del motor
  api/            Express + TS — API REST sobre Postgres
  excel-service/  Python + FastAPI — descarga/exporta Excel (aparte, ver su propio README)
packages/
  shared/    Tipos TS compartidos entre web y api
  db/        Schema de Prisma + migraciones (Postgres)
docker-compose.yml   Postgres para desarrollo local
```

Esta estructura es **provisoria**: cuando Martín (Nestlé) comparta el
scaffold real de Backstage, migramos ahí. Por eso se mantiene todo
bien separado por responsabilidad (apps por un lado, paquetes
compartidos por otro) — mover cada carpeta a un repo/scaffold nuevo
no debería requerir reescribir nada, solo mover archivos.

El schema de `packages/db/prisma/schema.prisma` está adaptado desde
`../04-diseno-tecnico/schema-movil-ventas.sql` (borrador en T-SQL /
SQL Server). El detalle de cada cambio de motor (tipos, vista de
cuadratura, JSON, etc.) está documentado al final de ese mismo archivo
`schema.prisma` — léelo antes de tocar el modelo de datos.

**Para ver el schema tabla por tabla** (qué es cada una, sus columnas,
sus relaciones): `packages/db/tablas/`, un archivo por tabla.

**Para levantar el schema sin pasar por Prisma** (por ejemplo si
alguien solo necesita la base para probar algo puntual, sin tocar
código), hay dos variantes — usar la que le quede más cómoda a cada
uno, las dos crean las mismas 11 tablas:

- `packages/db/schema-completo.sql` (Postgres) — se corre con `psql`
  contra el Postgres de `docker-compose.yml`.
- `packages/db/schema-completo.mssql.sql` (SQL Server) — para quien
  prefiera algo más parecido a Azure SQL. Instrucciones de Docker
  arriba de ese mismo archivo.

La app (`apps/api`, `apps/excel-service`, Prisma) está armada para
Postgres — la variante SQL Server es para tener una base de
referencia rápida o comparar contra Azure SQL, no la usa el código.

## Estructura de `apps/api`

```
src/
  index.ts       bootstrap (levanta el server, nada más)
  app.ts         arma la app: seguridad -> cors -> rutas -> error handler
  middleware/    seguridad (helmet, rate limit), manejo de errores, auth
  routes/        mapeo URL -> controller
  controllers/   lógica de cada endpoint (llaman a @motor/db)
```

Nada de lógica de negocio en `routes/` ni en `app.ts` — solo enganchan
piezas. Para sumar un endpoint nuevo: un controller en `controllers/`,
una ruta en `routes/`, y registrarla en `routes/index.ts`. Mismo
patrón para cada tabla del motor (objetivos, participación,
excepciones, etc — `canales` es la plantilla).

**Seguridad ya aplicada** (a todas las rutas, en `app.ts`):
headers de seguridad (`helmet`) y rate limiting general (300 req /
15 min por IP). **Falta definir auth** — `middleware/auth.ts` tiene el
placeholder (`requireAuth`) ubicado en el lugar correcto pero sin
aplicar todavía, a la espera de que se confirme el mecanismo (SSO de
Nestlé, API key entre servicios, JWT propio).

## Requisitos

- Node.js ≥ 20 (usa el que ya tenés instalado: `node -v`)
- Docker Desktop corriendo (para Postgres)
- Python ≥ 3.11 — solo si vas a trabajar en `apps/excel-service`

No hace falta instalar Postgres, pnpm ni nada global: todo corre con
`npm` (workspaces nativos) y `docker compose`.

`npm run dev` levanta `web` + `api` + Postgres. **`excel-service` no
está incluido** (es Python, no entra en los workspaces de npm) — se
levanta aparte siguiendo su propio `apps/excel-service/README.md`.

## Puesta en marcha (una sola vez por máquina)

```bash
git clone <url-del-repo>
cd 06-motor-distribucion
cp .env.example .env
npm install
```

## Levantar todo (un solo comando)

```bash
npm run dev
```

Esto hace, en orden:
1. `docker compose up -d db` — levanta Postgres si no está corriendo.
2. Espera a que Postgres responda (`pg_isready`).
3. Genera el Prisma Client y aplica las migraciones (`prisma migrate deploy`).
4. Arranca la API (`http://localhost:4000`) y el front (`http://localhost:5173`)
   en paralelo, con logs identificados por color.

Para cortar todo: `Ctrl+C` (para los procesos de Node) y, si querés
apagar también la base, `npm run db:down`.

## Comandos sueltos (para debug puntual)

| Comando | Qué hace |
|---|---|
| `npm run db:up` | Solo levanta Postgres |
| `npm run db:down` | Apaga y desmonta el contenedor de Postgres |
| `npm run db:migrate` | Crea una migración nueva a partir de cambios en `schema.prisma` (modo dev, interactivo) |
| `npm run db:studio` | Abre Prisma Studio (UI para ver/editar datos) en `http://localhost:5555` |
| `npm run dev:api` | Corre solo la API |
| `npm run dev:web` | Corre solo el front |
| `npm run build` | Build de producción de todos los paquetes/apps |

## Variables de entorno

Ver `.env.example`. Los valores por defecto ya coinciden con
`docker-compose.yml`, así que para desarrollo local alcanza con
copiar el archivo sin tocar nada:

```bash
cp .env.example .env
```

## Si cambia el schema de la base

1. Editar `packages/db/prisma/schema.prisma`.
2. Correr `npm run db:migrate` — te va a pedir un nombre para la
   migración y va a generar el SQL en `packages/db/prisma/migrations/`.
3. Commitear la carpeta de migración generada junto con el cambio de
   schema (así el resto del equipo la aplica con `db:migrate` o,
   automáticamente, la próxima vez que corra `npm run dev`).

## Troubleshooting rápido

- **"port 5432 already in use"**: ya tenés un Postgres corriendo en tu
  máquina (local o de otro proyecto). Parar ese servicio o cambiar el
  puerto en `docker-compose.yml` y en `DATABASE_URL` del `.env`.
- **La web no encuentra la API**: confirmar que `VITE_API_URL` en `.env`
  apunta al puerto donde efectivamente está la API (`API_PORT`).
- **Docker no está corriendo**: abrir Docker Desktop antes de
  `npm run dev` — el script falla explícitamente si no puede levantar
  el contenedor, en vez de quedarse colgado.
