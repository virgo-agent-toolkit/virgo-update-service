var async = require('async');
var Etcd = require('node-etcd');
var os = require('os');
var url = require('url');
var logger = require('../logger');

var TTL = 10; // Seconds
var REREGISTER = 7; // Seconds

function makeid(length)
{
  length = length || 5;
  var text = "",
      possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
      i;

  for(i=0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}

var suffix = makeid();

function instanceId() {
  return os.hostname() + '-' + suffix;
}

function _register(client, callback) {
  return function() {
    async.series([
      function(callback) {
        client.mkdir('/service/upgrade', function(err) {
          if (err && err.errorCode === 102) {
            callback();
          } else {
            callback(err);
          }
        });
      },
      function(callback) {
        client.set('/service/upgrade/' + instanceId(), 'ok', { ttl: TTL }, callback);
      }
    ], callback);
  };
}

function register(options) {
  var hosts = options.etcd_hosts || ['etcd://127.0.0.1:4001/'],
      registered = false,
      index = 0,
      client;

  async.whilst(
    function() {
      return !registered;
    },
    function(callback) {
      var parsed = url.parse(hosts[index % hosts.length]);
      parsed.port = parsed.port || 4001;
      client = new Etcd(parsed.hostname, parsed.port);
      _register(client, function(err) {
        if (err) {
          setTimeout(callback, 5000);
          callback();
        } else {
          registered = true;
          callback();
        }
      })();
    },
    function(err) {
      if (err) {
        return;
      }
      logger.info('Registered as ' + instanceId());
      setInterval(_register(client), REREGISTER);
    });
}

exports.register = register;
