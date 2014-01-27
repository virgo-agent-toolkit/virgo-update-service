REPORTER = spec
MOCHA_FLAGS = -t 5000 -s 500

all: lint test

lint:
	node_modules/.bin/nodelint --config .jslint.conf server/lib/**/*.js server/bin/*

test: lint
	@NODE_ENV=mocha ./node_modules/.bin/mocha \
		--reporter $(REPORTER) $(MOCHA_FLAGS)

.PHONY: test all lint
