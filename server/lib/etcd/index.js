var _ = require('underscore');
var async = require('async');
var events = require('events');
var log = require('logmagic').local('etcd');
var address = require('network-address');
var sprintf = require('sprintf').sprintf;
var qs = require('querystring');
var request = require('request');
var roundround = require('roundround');
var util = require('util');
var url = require('url');

var DEFAULTS = {
  timeout: 10000,
  urls: '',
  machine_refresh: 60000
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
* Watch
*
* @param key
* @param opts
* @param client
* @return
*/
function Watch(client, key, waitIndex, recursive) {
  events.EventEmitter.call(this);
  this.log = require('logmagic').local(sprintf('watch (key=%s)', key));
  this.cancelled = false;
  this.key = key;
  this.client = client;
  this.watching = false;
  this.recursive = recursive;
  this._waitIndex = waitIndex;
  log.debug('Created Watch', {key: this.key});
}
util.inherits(Watch, events.EventEmitter);


/**
 * cancel
 * @return
 */
Watch.prototype.cancel = function() {
  this.cancelled = true;
};


/**
 * run
 * @return
 */
Watch.prototype.run = function() {
  var self = this;
  async.whilst(
    function() {
      return self.cancelled === false;
    },
    function(callback) {
      self.runOnce(callback);
    },
    function(err) {
      if (err) {
        self.emit('error', err);
      } else {
        self.emit('end');
      }
    }
  );
  return self;
};


/**
 * runOnce
 *
 * @param callback (err, response, watch)
 * @return
 */
Watch.prototype.runOnce = function(callback) {
  var self = this,
      opts = { json: true, qs: { wait: true } };

  if (self._waitIndex) {
    opts.qs.waitIndex = self._waitIndex;
  }
  
  if (self.recursive) {
    opts.qs.recursive  = self.recursive === true;
  }

  self.client._request('/v2/keys' + self.key, opts, function(err, response) {
    if (err) {
      self.log.error('error', {err: err});
      self.emit('error', err, self);
    } else {
      self.log.debug('event', {waitIndex: self._waitIndex });
      self._waitIndex = response.node.modifiedIndex + 1;
      self.emit('event', response, self);
    }
    callback(err, response, self);
  });
};


/**
 * @constructor
 * @param options
 */
function Client(options) {
  events.EventEmitter.call(this);
  this.options = _.defaults(options || {}, DEFAULTS);
  this.urls = GLOBAL_URLS || this.options.urls;
  this.refreshTimer = null;
}
util.inherits(Client, events.EventEmitter);


/**
 * machines
 *
 * @param callback
 */
Client.prototype.machines = function(callback) {
  this._request('/v2/machines', callback);
};


/**
 * _refresh
 *
 * @return
 */
Client.prototype._refresh = function() {
  var self = this,
      splits;
  self.machines(function(err, machines) {
    if (err) { 
      log.error('could not refresh etcd servers', err.message);
      self.emit('error', err);
      return;
    }
    splits = machines.split(', ');
    if (splits.length > 0) {
      self.urls = GLOBAL_URLS = splits.join(',');
      self.emit('machines', self.urls);
      log.debug('updating etcd machines', self.urls);
    }
  });
};


/**
 * refresh
 *
 * @param callback
 */
Client.prototype.refresh = function() {
  var self = this;
  if (self.refreshTimer) {
    return;
  }
  self.once('machines', function() {
    self.refreshTimer = setInterval(_.bind(self._refresh, self), self.options.machine_refresh);
    self.refreshTimer.unref();
  });
  self._refresh();
};


/**
 * _request
 *
 * @param path
 * @param opts
 * @param callback
 */
Client.prototype._request = function(path, opts, callback) {
  var loop, parsed, protocol, ns, urls, tries;

  if (typeof(opts) === 'function') {
    callback = opts;
    opts = {};
  }

  urls = this.urls.split(',');
  tries = urls.length;

  loop = function() {
    var offset = (Math.random() * urls.length) | 0,
        next = roundround(urls.slice(offset).concat(urls.slice(0, offset))),
        host;
    host = next();
    log.debug('_request', { url: host + path, opts: opts });
    request(opts.location || (host+path), opts, function onResponse(err, response) {
      if (err) {
        if (opts.location) {
          delete opts.location;
        }
        if (--tries <= 0) {
          return callback(err);
        }
        return setTimeout(loop, 1000);
      }

      if (response.statusCode === 307) {
        return request(opts.location = response.headers.location, opts, onResponse);
      }
      if (response.statusCode === 404) {
        return callback();
      }
      if (response.statusCode > 299) {
        return callback(new Error(util.format('bad status code %d', response.statusCode)));
      }

      callback(null, response.body);
    });
  };

  loop();
};


/**
 * @param key
 * @param opts
 * @param callback
 */
Client.prototype.deleteLock = function(key, index, callback) {
  callback = callback || function() {};
  log.debug('delete lock', {key: key, index: index });
  this._request('/mod/v2/lock/' + key, {qs: {index: index}, method: 'DELETE'}, callback);
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
  self._request('/mod/v2/lock/' + key + '?ttl=' + ttl, {method: 'POST'}, function(err, index) {
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
  var opts = { form: { field: index } };
  this._request('/mod/v2/lock/' + key, opts, callback);
};


/**
 * renewLock
 *
 * @param key
 * @param ttl
 * @param callback
 */
Client.prototype.renewLock = function(key, ttl, index, callback) {
  this._request('/mod/v2/lock/' + key + '?ttl=' + ttl,
                {form: { index: index }, method: 'PUT'},
                callback);
};


/**
 * setKey
 *
 * @param key
 * @param payload
 * @param callback
 */
Client.prototype.set = function(key, payload, callback) {
  if (typeof(payload) === 'function') {
    callback = payload;
    payload = {};
  }
  payload = _.pick(payload || {}, 'ttl', 'value', 'dir', 'prevExist', 'prevValue', 'prevIndex');
  var opts = { json: true, form: payload, method: 'PUT'};
  this._request('/v2/keys' + key, opts, callback);
};


/**
 * getKey
 *
 * @param key
 * @param callback
 */
Client.prototype.get = function(key, index, callback) {
  var opts = { json: true };
  this._request('/v2/keys' + key, opts, callback);
};



/**
 * watch
 *
 * @param key
 * @param waitIndex
 * @param recursive
 * @return
 */
Client.prototype.watch = function(key, waitIndex, recursive) {
  return new Watch(this, key, waitIndex, recursive);
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
