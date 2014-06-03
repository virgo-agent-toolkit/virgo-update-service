var _ = require('underscore');
var async = require('async');
var events = require('events');
var log = require('logmagic').local('etcd');
var address = require('network-address');
var sprintf = require('sprintf').sprintf;
var request = require('request');
var util = require('util');
var url = require('url');
var Etcd = require('node-etcd');

var DEFAULTS = {
  timeout: 10000,
  urls: '',
  machine_refresh: 0
};


var GLOBAL_URLS;


/**
 * Lock
 *
 * @param index
 * @param key
 * @param client
 * @return
 */
function Lock(index, key, client) {
  this.index = index;
  this.client = client;
  this.key = key;
}


/**
 * refresh
 *
 * @param ttl
 * @param callback
 * @return
 */
Lock.prototype.refresh = function(ttl, callback) {
  callback = callback || function() {};
  this.client.renewLock(this.key, ttl, this.index, callback);
};


/**
 * @constructor
 * @param options
 */
function Client(options) {
  Etcd.call(this);
  this.options = _.defaults(options || {}, DEFAULTS);
  this.urls = GLOBAL_URLS || this.options.urls;
  this.refreshTimer = null;
}
util.inherits(Client, Etcd);


/**
 * @param key
 * @param opts
 * @param callback
 */
Client.prototype.deleteLock = function(key, index, callback) {
  callback = callback || function() {};
  log.debug('delete lock', {key: key, index: index });
  this.raw('DELETE", "/mod/v2/lock/' + key, {index: index}, {}, callback);
};


/**
 * aquireLock
 *
 * @param key
 * @param ttl
 * @param callback
 * @return
 */
Client.prototype.aquireLock = function(key, ttl, callback) {
  var self = this;
  self.raw('POST', '/mod/v2/lock/' + key + '?ttl=' + ttl, null, {}, function(err, index) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, new Lock(index, key, self));
  });
};

/**
 * getLock
 *
 * @param key
 * @param callback
 * @return
 */
Client.prototype.getLock = function(key, index, callback) {
  this.raw('GET', '/mod/v2/lock/' + key, { field: index }, {}, callback);
};


/**
 * renewLock
 *
 * @param key
 * @param ttl
 * @param callback
 */
Client.prototype.renewLock = function(key, ttl, index, callback) {
  this.raw('PUT', '/mod/v2/lock/' + key + '?ttl=' + ttl, { index: index }, {}, callback);
};


/**
 * cache
 *
 * @param key
 * @param ttl
 * @param work
 * @param callback
 * @return
 */
Client.prototype.cache = function(key, ttl, work, callback) {
  var self = this;

  self.get(key, function(err, resp) {
    if (err) {
      callback(err);
      return;
    }
    if (resp) {
      var args;
      try {
        args = JSON.parse(resp.node.value);
      } catch (try_err) {
        callback(try_err);
        return;
      }
      callback.apply(null, args);
    } else {
      work(function() {
        var args = Array.prototype.slice.call(arguments, 0),
            values;
        if (args[0]) {
          callback(args[0]);
        } else {
          try {
            values = JSON.stringify(args);
          } catch (try_err) {
            callback(try_err);
            return;
          }
          self.set(key, {ttl: ttl, value: values}, function(err) {
            if (err) {
              callback(err);
              return;
            }
            callback.apply(null, args);
          });
        }
      });
    }
  });
};


/**
 * lock
 *
 * @param key
 * @param ttl
 * @param callback
 */
Client.prototype.lock = function(key, ttl, lockedCallback, callback) {
  var self = this, index;
  log.debug('locking', {key: key, ttl: ttl});
  async.auto({
    aquire: function(callback) {
      self.aquireLock(key, ttl, callback);
    },
    get: ['aquire', function(callback, results) {
      index = results.aquire.index;
      self.getLock(key, index, callback);
    }],
    criticalSection: ['get', function(callback) {
      lockedCallback(new Lock(index, key, self), callback);
    }],
    unlock: ['criticalSection', function(callback) {
      self.deleteLock(key, index, callback);
    }]
  }, function(err, results) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, results.aquire);
  });
};


/**
 * Export Client
 */
exports.Client = Client;
