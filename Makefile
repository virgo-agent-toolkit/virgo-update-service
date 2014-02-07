REPORTER = spec
MOCHA_FLAGS = -t 5000 -s 500
MOCHA_CMDLINE = ./node_modules/.bin/mocha --reporter $(REPORTER) $(MOCHA_FLAGS)

all: lint test

lint:
	./node_modules/.bin/nodelint --config .jslint.conf server/lib/**/*.js server/bin/*

run-dev:
	@if [ -z "${TEST_USERNAME}" ] ; then \
	  echo Environment variable TEST_USERNAME is required. ; \
	  exit 1 ; \
	fi
	@if [ -z "${TEST_APIKEY}" ] ; then \
	  echo Environment variable TEST_APIKEY is required. ; \
	  exit 1 ; \
	fi
	./node_modules/.bin/nodemon \
	  server/bin/virgo-update-service -- \
		--peers http://192.168.50.4:4001 \
		--peers http://192.168.50.4:4002 \
		--peers http://192.168.50.4:4003 \
		--bind-addr 127.0.0.1:34000 \
		-t upgrade-service.htpasswd \
		-u ${TEST_USERNAME} \
		-a ${TEST_APIKEY} \
		-s 'secret'

deps:
	npm install
	./node_modules/.bin/bower install --allow-root

autotest:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--growl \
		--watch

test:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--growl \
		--watch

test: lint
	$(MOCHA_CMDLINE)

.PHONY: test all lint
