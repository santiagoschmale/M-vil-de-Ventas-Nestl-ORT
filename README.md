# ${{ values.name }} - React + Python Monorepo

Single GitHub repository hosting a **React frontend** and a **Python backend** for the same application, generated from the IDP Backstage portal.

## Repository Layout

```
.
├── .github/
│   ├── CODEOWNERS
│   └── workflows/
│       └── ci.yaml          # Combined pipeline (frontend + backend jobs)
├── catalog-info.yaml        # Backstage component descriptor
├── frontend/                # React 18 + Vite + TypeScript + MUI
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   └── ...
└── backend/                 # FastAPI + Uvicorn (Python 3.11)
    ├── Dockerfile
    ├── app.py
    ├── requirements.txt
    ├── src/
    └── tests/
```

Each subdirectory keeps its own `README.md` with component-specific instructions:

- [`frontend/README.md`](frontend/README.md)
- [`backend/README.md`](backend/README.md)

## Getting Started

Open two terminals — one per component.

### Frontend

```bash
cd frontend
echo "//pkgs.dev.azure.com/nestle-it/BR-DIGITAL-NEW-TECH/_packaging/nbra-js-feed/npm/registry/:_authToken=${AZ_DEVOPS_PAT}" >> .npmrc
npm ci
npm run dev
```

The Vite dev server runs with MSW intercepting `/api/*` calls, so no backend is required to iterate on UI.

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
export PIP_EXTRA_INDEX_URL="<your-INDEX_URL>"
make deps
python3 app.py
```

FastAPI listens on `:3000`. With `IS_LOCAL=true` (the default), Key Vault initialization is skipped.

## CI / CD

`.github/workflows/ci.yaml` calls the platform reusable workflow `nestle-it/nbra-platform-workflows/.github/workflows/pipeline-new-platform.yaml@main` **twice** — once per component — passing the same inputs the standalone templates use:

| Job        | `language` | `working_directory` | Notes                              |
|------------|------------|---------------------|------------------------------------|
| `frontend` | `react`    | `frontend`          |                                    |
| `backend`  | `python`   | `backend`           | `dockerfile: Dockerfile.python-release` |

Both jobs trigger on pushes to `main`, `release_candidate/*`, `hotfix/*`, `develop`, and on `workflow_dispatch`.

## Docker

Each component ships its own Dockerfile and is built independently:

```bash
docker build --build-arg AZ_DEVOPS_PAT=<token> -t ${{ values.name }}-frontend ./frontend
docker build --build-arg INDEX_URL="<index-url>" -t ${{ values.name }}-backend ./backend
```

See each component's README for the full build/run details.

## Tech Stack

**Frontend** — React 18, Vite, TypeScript, MUI, Zustand, React Router, Vitest, MSW
**Backend** — Python 3.11, FastAPI, Uvicorn, nbra-logger-py, nbra-envs-python, nose2, mutmut, black, flake8, pylint
