deps:
	pip3 install -r requirements.txt
	pip3 install -r requirements.dev.txt
	pip3 install nose2[coverage_plugin]

test:
	nose2 -v --with-coverage --coverage-report html --coverage-report term --coverage-report xml

# Desarrollo local sin acceso al índice privado de Nestlé: instala todo menos
# las librerías nbra-*, y en su lugar los reemplazos de local_shims/.
# Nunca pedir las nbra-* al índice público: no existen ahí, y si alguien
# registrara esos nombres se instalaría código ajeno (dependency confusion).
deps-local:
	grep -v '^nbra-' requirements.txt > .requirements.publicas.txt
	pip3 install -r .requirements.publicas.txt -r requirements.dev.txt ./local_shims/nbra_logger ./local_shims/nbra_envs_python
	rm .requirements.publicas.txt
