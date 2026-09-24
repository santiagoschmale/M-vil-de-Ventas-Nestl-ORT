# ${{ values.name }} - Python Web Application

Python backend application built with FastAPI and Uvicorn.

This repository was generated from the IDP Backstage portal and can be used locally or using IDP's GitHub Codespace Repository.

## Tech Stack

- **Python 3.11** with FastAPI
- **Uvicorn** as ASGI server
- **nbra-logger-py** for structured logging
- **nbra-envs-python** for Azure Key Vault + GitOps configuration
- **nose2** for testing with coverage
- **mutmut** for mutation testing
- **black** + **flake8** + **pylint** for formatting and linting

## Getting Started

### Prerequisites

- Python 3.11+
- `INDEX_URL` - Azure DevOps Package Artifact URL with an embedded PAT token for accessing the `nbra-pypi-feed` private registry

To generate the `INDEX_URL`, create a Personal Access Token (PAT) in Azure DevOps with **Packaging (Read)** scope and build the URL in the following format:

```
https://nestle-it:<PAT>@pkgs.dev.azure.com/nestle-it/BR-DIGITAL-NEW-TECH/_packaging/nbra-pypi-feed/pypi/simple/
```

For more details, see the [artifact registry connection guide](https://dev.azure.com/nestle-it/BR-DIGITAL-NEW-TECH/_artifacts/feed/nbra-pypi-feed/connect).

### Install dependencies

It is strongly recommended to use a virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate
```

Set the private registry and install dependencies:

```bash
export PIP_EXTRA_INDEX_URL="<your-INDEX_URL>"
make deps
```

### Development

```bash
python3 app.py
```

Starts the Uvicorn server on port 3000. When running locally (`IS_LOCAL=true`, the default), Key Vault initialization is skipped.

### Testing

```bash
make test
```

Runs nose2 with coverage reporting (HTML, terminal, and XML).

### Linting

```bash
flake8 .
pylint src/
black --check .
```

## API

| Endpoint | Description |
|---|---|
| `GET /health` | Health check - returns `OK` |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `IS_LOCAL` | `true` | Set to `false` in production to enable Key Vault config loading |

## Docker

The Dockerfile uses a multi-stage build with a distroless final image for minimal attack surface.

### Build the image

The `INDEX_URL` build argument is required to authenticate against the private Azure DevOps PyPI registry during `pip install`. Generate a PAT and build the URL as described in the [Prerequisites](#prerequisites) section.

```bash
docker build --build-arg INDEX_URL="https://<PAT>@pkgs.dev.azure.com/nestle-it/BR-DIGITAL-NEW-TECH/_packaging/nbra-pypi-feed/pypi/simple/" -t ${{ values.name }} .
```

### Run the container

```bash
docker run -p 3000:3000 ${{ values.name }}
```

The application will be available at `http://localhost:3000`.

## Project Structure

```
app.py                    # Application entry point
requirements.txt          # Production dependencies
requirements.dev.txt      # Development dependencies
Makefile                  # Build and test commands
src/
  config/
    logger.py             # Logger configuration
  middleware/
    error_handler.py      # Global error handling middleware
  routes/
    health.py             # Health check endpoint
tests/
  routes/
    test_health.py        # Health route tests
  test_app.py             # Application tests
```
