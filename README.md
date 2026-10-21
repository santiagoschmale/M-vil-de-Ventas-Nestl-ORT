# Móvil de Ventas — Nestlé Professional Argentina × ORT

Herramienta para armar el móvil de ventas, el objetivo mensual. El planner carga
tres archivos:

- el objetivo de Contraloría por SKU;
- los totales por canal;
- el mes anterior.

Con eso, la herramienta hace el primer reparto sola:

- cruza SKU × canal;
- abre cada canal entre sus distribuidores o vendedores;
- respeta las reglas y el ON/OFF de cada entidad.

Marca lo que no puede cerrar y deja que una persona lo ajuste, lo apruebe y lo
exporte a Excel. Todo cuadra exacto, en kilos y en pesos, y cada ajuste queda con
quién, cuándo y por qué.

Proyecto final de la Universidad ORT para Nestlé DIL Región Plata, sep-nov 2026.

## Correrlo

Se necesita Python 3.13 o 3.14 y Node con npm. Sin Docker, todo vive en memoria y se
pierde al reiniciar. Para que cada móvil quede guardado, con Docker Desktop abierto:
`make db` (levanta Postgres y aplica las migraciones) y después `make dev-db`.

**No correr `npm install` a secas en `frontend/`**: el `.npmrc` apunta al registro
privado de Nestlé, sin acceso desde acá. Los pasos de abajo usan el registro
público, y para las librerías internas del backend, los reemplazos de
`backend/local_shims/`.

### Mac y Linux

Con `make` (en Mac viene con `xcode-select --install`), desde la raíz:

```bash
make instalar
```

```bash
make dev
```

Otra versión de Python: `make instalar PYTHON=python3.14`. Tests: `make test`.

### Windows (PowerShell)

Instalar, una vez, desde la raíz:

```powershell
cd backend
py -3.14 -m venv .venv
Get-Content requirements.txt | Where-Object { $_ -notmatch '^nbra-' } | Set-Content -Encoding ascii .requirements.publicas.txt
.venv\Scripts\pip install -r .requirements.publicas.txt -r requirements.dev.txt .\local_shims\nbra_logger .\local_shims\nbra_envs_python
cd ..\frontend
npm ci --registry https://registry.npmjs.org
```

Levantarlo, en dos terminales:

```powershell
cd backend; $env:IS_LOCAL="true"; .venv\Scripts\python app.py
```

```powershell
cd frontend; npx vite --port 5175 --strictPort
```

Tests:

```powershell
cd backend; $env:IS_LOCAL="false"; .venv\Scripts\python -m nose2
```

```powershell
cd frontend; npx vitest --watch=false
```

### Después

Abrir http://localhost:5175 y tocar "Cargar datos de muestra". Si la pantalla dice
"Contestó otra aplicación", otro programa está usando el puerto 3000.

## Desplegarlo con Docker

Probado: dos imágenes (API y pantalla) y un PostgreSQL 16. Desde la raíz:

```bash
docker build -t movil-backend --build-arg INDEX_URL=<índice privado de Python> backend
docker build -t movil-frontend --build-arg AZ_DEVOPS_PAT=<token del registro npm> frontend
```

Sin `INDEX_URL`, el backend usa los reemplazos de `backend/local_shims` en vez de las
librerías `nbra-*` (nunca las busca en el índice público). Sin `AZ_DEVOPS_PAT`, el
front instala desde el registro público.

```bash
docker network create movil
docker run --rm --network movil -e DATABASE_URL=<url de Postgres> --entrypoint /venv/bin/alembic movil-backend upgrade head
docker run -d --name backend --network movil -e DATABASE_URL=<url de Postgres> -e IS_LOCAL=false movil-backend
docker run -d --name movil-frontend --network movil -p 8080:80 movil-frontend
```

- `DATABASE_URL`: `postgresql://usuario:clave@host:5432/base`. La primera línea crea
  las tablas; se corre de nuevo con cada versión nueva. Sin `DATABASE_URL`, todo vive
  en memoria y se pierde al reiniciar.
- **El contenedor de la API se tiene que llamar `backend`**: la pantalla (nginx) le
  pasa `/api` a `http://backend:3000`.
- `IS_LOCAL=false`: sin recarga automática ni "Empezar de cero". Con las `nbra-*`
  reales, además carga la configuración de Key Vault.
- La pantalla queda en el puerto 8080. Acepta archivos de hasta 50 MB.
- Hasta que haya login con Entra, todos entran como un usuario de prueba.

## Estructura

```
backend/            FastAPI (Python)
  src/domain/       las cuentas: cruce, reparto, apertura. No conoce ni HTTP ni Excel
  src/importer/     lectura de los Excel de entrada
  src/movil/        el móvil del mes: entradas, ajustes, historial, exportación
  src/routes/       la API /api/movil
frontend/           React + MUI: la pantalla del móvil
data/sample/        datos de prueba inventados, con la forma de los reales
docs/               dominio, plan y preguntas abiertas
```

## Documentación

| Doc | Para qué |
|---|---|
| [`docs/entendimiento-negocio.md`](docs/entendimiento-negocio.md) | El dominio: cómo se arma hoy el móvil, inputs, cruce, estructura, reglas |
| [`docs/plan.md`](docs/plan.md) | Qué se hizo, qué falta y en qué orden |
| [`docs/preguntas.md`](docs/preguntas.md) | Lo que falta definir con el cliente y con IT |
| [`backend/src/domain/NOTES.md`](backend/src/domain/NOTES.md) | Cómo está armado el código, supuestos en uso y gotchas |
| [`CLAUDE.md`](CLAUDE.md) | Reglas innegociables y decisiones tomadas: lo lee el equipo y Claude Code |

## Reglas del repo

- **Ningún dato real de Nestlé**: ni archivos, ni cifras, ni nombres. La muestra es
  inventada.
- **Decimal, nunca float**, en kilos y pesos.
- Los PRs usan el template de `.github/pull_request_template.md`.

## Del template de Nestlé

El repo parte del scaffold de Backstage
([`docs/template-reference.md`](docs/template-reference.md)).

- **CI**: `checks.yml` corre en cada PR los tests del backend y los tipos, tests y
  build del front. `ci.yaml` es el del template: llama al workflow de plataforma de
  Nestlé, que desde acá no corre. Cuando llegue el repo real, cada merge despliega
  con ArgoCD.
- **Docker**: ver "Desplegarlo con Docker", arriba.
