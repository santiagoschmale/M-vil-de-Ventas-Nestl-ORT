# excel-service

Microservicio Python (FastAPI) para descargar/exportar Excel hacia y
desde la plataforma. Va aparte de `apps/api` (Node/Express) a propósito:
distinta responsabilidad, distinto runtime.

No corre migraciones ni es dueño del schema — lee y escribe sobre las
mismas tablas de Postgres que crea Prisma (`packages/db`). Si el schema
cambia, este servicio se entera por los modelos SQLAlchemy en
`app/models/`, que hay que mantener a mano en paralelo a
`packages/db/prisma/schema.prisma`.

## Estructura (MVC)

```
app/
  main.py        bootstrap de FastAPI
  database.py    conexión SQLAlchemy (mismo Postgres que Node)
  models/        tablas mapeadas con SQLAlchemy (el "M" de MVC)
  routers/       endpoints HTTP (el "C", controllers de FastAPI)
  services/      lógica de negocio (armar/leer el .xlsx con pandas)
  schemas/       (vacío por ahora) modelos Pydantic de request/response
```

## Levantarlo (independiente del resto, requiere Python ≥ 3.11)

```bash
cd apps/excel-service
python3 -m venv .venv
source .venv/bin/activate        # en Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Necesita la misma Postgres que el resto del monorepo corriendo
# (npm run db:up desde la raíz, o docker compose up -d db)
export DATABASE_URL="postgresql://motor:motor@localhost:5432/motor_distribucion"

uvicorn app.main:app --reload --port 8000
```

Health check: `http://localhost:8000/health`
Docs interactivas (Swagger): `http://localhost:8000/docs`

## Endpoints actuales

- `GET /excel/exportar/{periodo}` — descarga un `.xlsx` con la
  Participación cargada para ese período.
- `POST /excel/importar/{periodo}` — sube un `.xlsx` con el mismo
  formato y crea filas de Participación (`origen = 'manual'`).

Son plantilla: para exportar/importar otras tablas (ObjetivoTotal,
histórico de MovilAprobado) se agrega un modelo nuevo en `models/`,
una función en `services/excel_service.py` y una ruta en
`routers/excel_router.py`, siguiendo el mismo patrón.

## Pendiente de decidir con el equipo

- Si este servicio va a tener su propio contenedor en
  `docker-compose.yml` de la raíz, o se sigue corriendo aparte a mano
  (por ahora es lo segundo, para no atarnos a nada antes de tener
  claro cómo se conecta con Azure SQL / Backstage de Nestlé).
