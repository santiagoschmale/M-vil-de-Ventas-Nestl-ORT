# Móvil de ventas: levantar y probar en local.
#
#   make instalar   una vez (y cuando cambien las dependencias)
#   make dev        API + pantalla; abrir http://localhost:5175
#   make test       tests del backend y del front
#
# Sin acceso a los registros privados de Nestlé: el backend usa los reemplazos de
# backend/local_shims (make deps-local) y el front baja todo del registro público
# de npm (el .npmrc del template apunta al feed privado).

PYTHON ?= python3.13
VENV := backend/.venv
NPM_PUBLICO := --registry https://registry.npmjs.org
# La API queda en :3000; vite le reenvía /api.
PUERTO_WEB := 5175

.DEFAULT_GOAL := ayuda
.PHONY: ayuda instalar api web dev test

ayuda:
	@echo "make instalar   entorno de Python y dependencias del front (una vez)"
	@echo "make dev        API en :3000 y pantalla en http://localhost:$(PUERTO_WEB), juntas (Ctrl+C corta las dos)"
	@echo "make api        solo la API (docs en http://localhost:3000/docs)"
	@echo "make web        solo la pantalla (necesita la API levantada)"
	@echo "make test       tests del backend y del front"

$(VENV):
	$(PYTHON) -m venv $(VENV)

instalar: $(VENV)
	cd backend && PATH="$$PWD/.venv/bin:$$PATH" $(MAKE) deps-local
	cd frontend && npm ci $(NPM_PUBLICO)

# La sesión del mes vive en memoria: reiniciar la API la pierde.
api:
	cd backend && IS_LOCAL=true .venv/bin/python app.py

web:
	cd frontend && npx vite --port $(PUERTO_WEB) --strictPort

# -j2 corre las dos a la vez en la misma terminal.
dev:
	$(MAKE) -j2 api web

test:
	cd backend && PATH="$$PWD/.venv/bin:$$PATH" $(MAKE) test
	cd frontend && npx vitest --watch=false
