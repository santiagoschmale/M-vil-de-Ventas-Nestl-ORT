# ${{values.name}} - React Web Application

React single-page application built with Vite, TypeScript, and Material UI.

This repository was generated from the IDP Backstage porta. The developer can use on a local development environment or using IDP's GitHub Codespaces Repository.

## Tech Stack

- **React 18** with TypeScript
- **Vite** for development and build tooling
- **Material UI (MUI)** for UI components
- **React Router** for client-side routing
- **Zustand** for state management
- **Vitest** + **React Testing Library** for testing
- **MSW (Mock Service Worker)** for API mocking in development

## Getting Started

### Prerequisites

- Node.js 22+
- `AZ_DEVOPS_PAT` - Azure DevOps Personal Access Token with read access to the `nbra-js-feed` artifact registry

### Install dependencies

```bash
echo "//pkgs.dev.azure.com/nestle-it/BR-DIGITAL-NEW-TECH/_packaging/nbra-js-feed/npm/registry/:_authToken=${AZ_DEVOPS_PAT}" >> .npmrc
npm ci
```

### Development

```bash
npm run dev
```

Starts the Vite dev server with hot module replacement. In development mode, API requests are intercepted by MSW (Mock Service Worker) so no backend is required.

### Build

```bash
npm run build
```

Compiles TypeScript and produces optimized static assets in `dist/`.

### Testing

```bash
npm run test            # run tests with coverage
npm run test:watch      # run tests in watch mode
```

### Linting

```bash
npm run lint
```

## Docker

The Dockerfile uses a multi-stage build to produce a lightweight nginx image that serves the compiled static assets.

### Build the image

The `AZ_DEVOPS_PAT` build argument is required to authenticate against the private Azure DevOps npm registry during `npm ci`.

```bash
docker build --build-arg AZ_DEVOPS_PAT=<your-token> -t ${{values.name}} .
```

### Run the container

```bash
docker run -p 80:80 ${{values.name}}
```

The application will be available at `http://localhost`.

### Mock API endpoints

The Docker image includes nginx-served mock endpoints for local development:

| Endpoint | Description |
|---|---|
| `GET /api/whoami` | Authenticated user info |
| `GET /api/users` | List of users |
| `GET /api/tokens` | List of API tokens |
| `GET /health` | Health check |

## Project Structure

```
src/
  infra/             # Infrastructure layer (HTTP clients)
  mocks/             # MSW handlers and mock data
  presentation/
    components/      # Shared UI components
    pages/           # Page-level components (Home, Users, Tokens)
    utils/           # Presentation utilities
  stores/            # Zustand state stores
```
