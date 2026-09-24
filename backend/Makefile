deps:
	pip3 install -r requirements.txt
	pip3 install -r requirements.dev.txt
	pip3 install nose2[coverage_plugin]

test:
	nose2 -v --with-coverage --coverage-report html --coverage-report term --coverage-report xml
