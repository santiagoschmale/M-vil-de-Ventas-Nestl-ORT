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

Se necesita Python 3.13 o 3.14, Node con npm y `make` (en Mac viene con
`xcode-select --install`). No hace falta Docker ni base de datos: por ahora todo
vive en memoria.

```bash
make instalar
```

```bash
make dev
```

Abrir http://localhost:5175 y tocar "Cargar datos de muestra".

- **Otra versión de Python**: `make instalar PYTHON=python3.14`.
- **Windows**: no hay `make`. Los pasos a mano están en
  [`backend/src/domain/NOTES.md`](backend/src/domain/NOTES.md#correrlo).
- **No correr `npm install` a secas en `frontend/`**: el `.npmrc` apunta al registro
  privado de Nestlé, sin acceso desde acá. `make instalar` usa el registro público, y
  para las librerías internas del backend, los reemplazos de `backend/local_shims/`.
- **Tests**: `make test` corre backend y front.

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
- **Docker**: cada parte tiene su `Dockerfile`, y necesita las credenciales de los
  registros privados.
