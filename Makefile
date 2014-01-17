REPORTER = spec
MOCHA_FLAGS = -t 5000 -s 500

jscoverage: ./node_modules/jscoverage/jscoverage.node

./node_modules/jscoverage/jscoverage.node:
	npm install jscoverage

lint:
	node_modules/.bin/nodelint --config .jslint.conf lib/**/*.js bin/*

test: lint jscoverage
	@NODE_ENV=mocha ./node_modules/.bin/mocha \
		--reporter $(REPORTER) $(MOCHA_FLAGS)

.PHONY: test jscoverage
