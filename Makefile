REPORTER = spec
MOCHA_FLAGS = -t 5000 -s 500

all: lint test

lint:
	node_modules/.bin/nodelint --config .jslint.conf server/lib/**/*.js server/bin/*

run_dev:
	@if [ -z "${TEST_USERNAME}" ] ; then \
	  echo Environment variable TEST_USERNAME is required. ; \
	  exit 1 ; \
	fi
	@if [ -z "${TEST_APIKEY}" ] ; then \
	  echo Environment variable TEST_APIKEY is required. ; \
	  exit 1 ; \
	fi
	node_modules/.bin/nodemon server/bin/virgo-update-service \
		--peers 127.0.0.1:1024 \
		-u ${TEST_USERNAME} \
		-a ${TEST_APIKEY}

deps:
	npm install
	node_modules/.bin/bower install --allow-root

test: lint
	@NODE_ENV=mocha ./node_modules/.bin/mocha \
		--reporter $(REPORTER) $(MOCHA_FLAGS)

.PHONY: test all lint
