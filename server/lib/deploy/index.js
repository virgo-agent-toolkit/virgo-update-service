var async = require('async');
var etcd = require('../etcd');
var EventEmitter = require('events').EventEmitter;
var download = require('../download');
var sprintf = require('sprintf').sprintf;
var path = require('path');
var util = require('util');
var Manifest = require('./manifest').Manifest;
var _ = require('underscore');

var Global = require('../deploy/global').Global;

var log = require('logmagic').local('virgo-upgrade-service.lib.deploy');

var DEFAULT_CHANNELS = [
  'stable',
  'unstable',
  'master'
];

var DEFAULT_DEPLOYS_KEY = '/deploys/%(channel)s';

/**
 * Deploy
 *
 * @constructor
 * @param options
 * @return
 */
function Deploy(options) {
  EventEmitter.call(this);
  this.watchers = [];
  this.options = options;
  this.deploys = {};
  this._channels = null;
  this._channels_versions = {};
}
util.inherits(Deploy, EventEmitter);


/**
 * _generateDeployKey
 *
 * @param channel
 * @return
 */
Deploy.prototype._generateDeployKey = function(channel) {
  return sprintf(DEFAULT_DEPLOYS_KEY, {channel: channel});
};


/**
 * _register
 *
 * @param channel
 * @param callback
 * @return
 */
Deploy.prototype._register = function(channel, callback) {
  log.info('Registering Deploy', { channel: channel });
  this.deploys[channel] = true;
  process.nextTick(callback);
};

/**
 * _deregister
 *
 * @param channel
 * @param callback
 * @return
 */
Deploy.prototype._deregister = function(channel, callback) {
  log.info('Deregistering Deploy', { channel: channel });
  delete this.deploys[channel];
  process.nextTick(callback);
};


/**
 * _download
 *
 * @param channel
 * @param version
 * @param callback
 * @return
 */
Deploy.prototype._download = function(version, callback) {
  log.info('Downloading', { version: version });
  callback = _.once(callback);
  var d = download.bucket(this.options, version)
    .on('error', callback)
    .on('end', callback);
};


/**
 * _onDeployEvent
 *
 * @param response
 * @return
 */
Deploy.prototype._onDeployEvent = function(response, watch) {
  var channel = path.basename(watch.key),
      self = this,
      values;

  try {
    values = JSON.parse(response.node.value);
  } catch (err) {
    log.error('value is not a json value');
    return;
  }

  log.info('Starting Deploy', { channel: channel, version: values.version });

  async.auto({
    'register': self._register.bind(self, channel),
    'download': ['register', self._download.bind(self, values.version)],
    'deregister': ['download', self._deregister.bind(self, channel)]
  }, function(err) {
    if (err) {
      self._deregister(channel, function() {
        log.error('deploy failed', _.pick(err, 'message'));
      });
      return;
    }
    log.info('deploy succeeded');
  });
};


/**
 * _startWatchers
 *
 * @param callback
 * @return
 */
Deploy.prototype._startWatchers = function(callback) {
  log.info('Starting Watchers');
  var self = this;
  _.each(DEFAULT_CHANNELS, function(channel) {
    var key = self._generateDeployKey(channel),
        client = new etcd.Client(),
        watch = client.watch(key, 0, false);
    watch.on('event', _.bind(self._onDeployEvent, self));
    self.watchers.push(watch.run());
  });
  process.nextTick(callback);
};


Deploy.prototype.write = function(line) {
  this.emit('line', line);
};


Deploy.prototype.getChannels = function(callback) {
  var global = new Global(),
      self = this;
  global.getChannels(function(err, results) {
    if (err) {
      callback(err);
    } else {
      self._channels = results;
      callback(null, self._channels);
    }
  });
};


Deploy.prototype.getVersionsForChannels = function(callback) {
  var global = new Global(),
      cv = {},
      self = this;

  function iter(ch, callback) {
    global.getChannelVersions(ch, function(err, results) {
      if (err) {
        cv[ch] = undefined;
        callback(err);
      } else {
        cv[ch] = results;
        callback();
      }
    });
  }

  async.auto({
    'channels': function(callback) {
      self.getChannels(callback);
    },
    'versions': ['channels', function(callback, results) {
      async.each(results.channels, iter, callback);
    }]
  }, function(err) {
    if (err) {
      callback(err);
    } else {
      self._channels_versions = cv;
      callback(null, cv);
    }
  });
};


Deploy.prototype.getLatestChannelsVersion = function(callback) {
  var self = this,
      global = new Global(),
      cv = {};

  function iter(ch, callback) {
    global.getLatestChannelVersion(ch, function(err, version) {
      if (!err) {
        cv[ch] = version;
      }
      callback(err);
    });
  }

  async.auto({
    'channels': self.getChannels.bind(self),
    'versions': ['channels', function(callback, results) {
      async.each(results.channels, iter, callback);
    }]
  }, function(err) {
    callback(err, cv);
  });  
};


Deploy.prototype.getChannels = function(callback) {
  new Global().getChannels(callback);
};


Deploy.prototype.run = function(callback) {
  var self = this,
      global = new Global();
  async.auto({
    watchers: function(callback) {
      self._startWatchers(callback);
    },
    channels: function(callback) {
      self.getChannels(callback);
    },
    check_for_deploys: ['channels', 'watchers', function(callback) {
      self.getVersionsForChannels(callback);
    }],
    check_local_exe_dir: ['check_for_deploys', function(callback, results) {
      var unique_versions = _.uniq(_.flatten(_.map(results.check_for_deploys, _.values)));
      async.eachLimit(unique_versions, 5, self._download.bind(self));
      callback();
    }]
  }, callback);
};


exports.Deploy = Deploy;
