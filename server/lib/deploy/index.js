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

var DEFAULT_DEPLOYS_KEY = '/deploys/%(channel)s';

var CURRENT_DEPLOYS = {};
var CURRENT_DOWNLOADS = {};

/**
 * Deploy
 *
 * @constructor
 * @param options
 * @return
 */
function Deploy(options) {
  EventEmitter.call(this);
  this.watchers = {};
  this.options = options;
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
Deploy.prototype._register = function(channel, version, callback) {
  log.info('Registering Deploy', { channel: channel });
  CURRENT_DEPLOYS[channel] = { version: version, channel: channel };
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
  delete CURRENT_DEPLOYS[channel];
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
  var d = download.bucket(this.options, version);
  CURRENT_DOWNLOADS[version] = true;
  d.on('error', function(err) {
    delete CURRENT_DOWNLOADS[version];
    callback(err);
  });
  d.on('end', function() {
    delete CURRENT_DOWNLOADS[version];
    callback();
  });
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
    'register': self._register.bind(self, channel, values.version),
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


Deploy.prototype._startWatcher = function(channel) {
  var key = this._generateDeployKey(channel),
      client = new etcd.Client(),
      watch;

  if (this.watchers[key]) {
    return;
  }

  watch = client.watch(key, 0, false);
  watch.on('event', _.bind(this._onDeployEvent, this));
  this.watchers[key] = watch.run();
};


/**
 * _startWatchers
 *
 * @param callback
 * @return
 */
Deploy.prototype._startWatchers = function(callback) {
  log.info('Starting Watchers');
  _.each(this._channels, _.bind(this._startWatcher, this));
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


Deploy.prototype.ensureChannelVersionsDownloaded = function(callback) {
  var unique_versions = _.uniq(_.flatten(_.map(this._channels_versions, _.values)));
  async.eachLimit(unique_versions, 5, this._download.bind(this), function(err) {
    if (!err) {
      log.info('All channels downloaded and ready');
    }
    callback(err);
  });;
};


Deploy.prototype.run = function(callback) {
  var self = this;
  async.auto({
    channels: function(callback) {
      self.getChannels(callback);
    },
    watchers: ['channels', function(callback) {
      self._startWatchers(callback);
    }],
    check_for_deploys: ['channels', 'watchers', function(callback) {
      self.getVersionsForChannels(callback);
    }],
    check_local_exe_dir: ['check_for_deploys', function(callback, results) {
      self.ensureChannelVersionsDownloaded(callback);
    }]
  }, callback);
};


Deploy.prototype.getDeployStatus = function(callback) {
  var stats = {};
  stats.current_downloads = _.keys(CURRENT_DOWNLOADS);
  stats.current_deploys = CURRENT_DEPLOYS;
  callback(null, stats);
};


exports.Deploy = Deploy;
