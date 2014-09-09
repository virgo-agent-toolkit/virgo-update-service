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
	  server/bin/virgo-update-service \
		--peers http://localhost:4001 \
		--bind-addr 127.0.0.1:34000 \
		-t upgrade-service.htpasswd \
		-u ${TEST_USERNAME} \
		-a ${TEST_APIKEY} \
		-s 'secret'

deps:
	npm install
	./node_modules/.bin/bower install --allow-root

test: lint
	@NODE_ENV=test ./node_modules/.bin/tap test/*.js

.PHONY: test all lint
