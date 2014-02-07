REPORTER = spec
MOCHA_FLAGS = -t 5000 -s 500

all: lint test

lint:
	node_modules/.bin/nodelint --config .jslint.conf lib/**/*.js bin/*

autotest:
	node_modules/.bin/supervisor -q -n exit -x ./node_modules/.bin/mocha \
		-- -b

test: lint
	@NODE_ENV=mocha ./node_modules/.bin/mocha \
		--reporter $(REPORTER) $(MOCHA_FLAGS)

.PHONY: test all lint
