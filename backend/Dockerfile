# Use this dockerfile on local setups and/or codespace enviroments.
# The image is very similar to the final deploy that is created in the Github Actions pipeline.

FROM debian:12-slim AS build

ARG INDEX_URL
RUN apt-get update && \
    apt-get install --no-install-suggests --no-install-recommends --yes python3-venv=3.11* gcc libpython3-dev && \
    python3 -m venv /venv && \
    /venv/bin/pip install --no-cache-dir --upgrade pip==26.0.1 setuptools==80.0.0 wheel==0.46.0 && \
    rm -rf /var/lib/apt/lists/*

FROM build AS build-venv

ARG INDEX_URL
ENV PIP_EXTRA_INDEX_URL=$INDEX_URL

COPY requirements.txt /requirements.txt
COPY local_shims /local_shims

# Con INDEX_URL (pipeline de Nestlé), las nbra-* salen del índice privado. Sin él, se usan los
# reemplazos de local_shims: nunca se buscan nbra-* en el índice público (otro podría publicarlas).
RUN if [ -n "$INDEX_URL" ]; then \
      /venv/bin/pip install --no-cache-dir --disable-pip-version-check -r /requirements.txt; \
    else \
      grep -v '^nbra-' /requirements.txt > /requirements.publicas.txt && \
      /venv/bin/pip install --no-cache-dir --disable-pip-version-check -r /requirements.publicas.txt \
        /local_shims/nbra_logger /local_shims/nbra_envs_python; \
    fi

FROM gcr.io/distroless/python3-debian12:nonroot

COPY --from=build-venv /venv /venv

COPY . /application
WORKDIR /application

USER nonroot

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["/venv/bin/python3", "-c", "exit(0)"]

ENTRYPOINT ["/venv/bin/python3", "app.py"]