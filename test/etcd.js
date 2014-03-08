var etcd = require('../server/lib/etcd');
var should = require('should');
var async = require('async');

if (!process.env.ETCD_URL) {
  console.log('ETCD_URL needs to be set in your environment');
  return;
}

var createClient = function() {
  return new etcd.Client({
    urls: process.env.ETCD_URL
  });
};

describe('set/get key', function() {
  var cl = createClient(),
      key = 'testKey2',
      value = 15;

  it('set without error', function(done) {
    cl.setKey(key, {value: value}, function(err) {
      if (err) { throw err; }
      done();
    });
  });

  it('get without error', function(done) {
    cl.getKey(key, function(err, results) {
      if (err) { throw err; }
      results.node.value.should.eql(value);
      done();
    });
  });
});

describe('set/get key with ttl', function() {
  var cl = createClient(),
      key = 'testKeyTTL',
      ttl = 5, value = 25;

  it('set key with TTL success', function(done) {
    cl.setKey(key, {ttl: ttl, value: value}, function(err, results) {
      if (err) { throw err; }
      results.node.value.should.eql(value);
      results.node.ttl.should.eql(ttl);
      done();
    });
  });

  it('get key with TTL success', function(done) {
    cl.getKey(key, function(err, results) {
      if (err) { throw err; }
      results.node.value.should.eql(value);
      done();
    });
  });
});

describe('set/get key test timeout', function() {
  var cl = createClient(),
      key = 'testKeyTTL2',
      ttl = 1, value = 35;

  this.timeout((ttl + 10) * 1000);

  it('set key with TTL without error', function(done) {
    cl.setKey(key, {ttl: ttl, value: value}, function(err, results) {
      if (err) { throw err; }
      results.node.value.should.eql(value);
      results.node.ttl.should.eql(ttl);
      setTimeout(done, (ttl + 1) * 1000);
    });
  });

  it('get key with TTL without error', function(done) {
    cl.getKey(key, function(err, results) {
      if (err) { throw err; }
      if (results !== undefined) throw new Error('results should be undefined');
      done();
    });
  });
});

describe('try lock', function() {
  var key = 'testLock2', ttl = 10;

  this.timeout((ttl + 5) * 1000);

  it('lock', function(done) {
    var c1 = createClient(), c2 = createClient();

    function criticalSection(lock, callback) {
      if (!lock) { throw new Error('lock not defined'); }
      setTimeout(callback, 200);
    }

    async.auto({
      lock1: function(callback) {
        c1.lock(key, ttl, criticalSection, callback);
      },
      lock2: function(callback) {
        c2.lock(key, ttl, criticalSection, callback);
      }
    }, done);
  });
});

describe('watch', function() {
  it('watch', function(done) {
    var c1 = createClient(),
        c2 = createClient();

    async.auto({

    }, done);
  });
});

