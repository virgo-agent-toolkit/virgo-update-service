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
 * generateDeployKey
 *
 * @param channel
 * @return
 */
Deploy.prototype.generateDeployKey = function(channel) {
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
  log.info('Deregistering Deploy', CURRENT_DEPLOYS[channel]);
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
  if (!d) {
    callback();
    return;
  }
  CURRENT_DOWNLOADS[version] = true;
  etcdClient = new etcd.Client(this.options.etcd_host, this.options.etcd_port);
  etcdClient.set('/deploys/downloads', JSON.stringify({"version": version, "status": "Downloading"}),
   {ttl: 3600},log.info('Downloading', { version: version }));
  
  d.on('error', function(err) {
    delete CURRENT_DOWNLOADS[version];
    etcdClient.set('/deploys/downloads', JSON.stringify({"version": version, "status": "Error"}),
     log.info('Download Error for', { version: version }));
    callback(err);
  });
  d.on('end', function() {
    delete CURRENT_DOWNLOADS[version];
    etcdClient.set('/deploys/downloads', JSON.stringify({"version": version, "status": "Downloaded"}),
     log.info('Downloaded', { version: version }));
    callback();
  });
};


/**
 * _onDeployEvent
 *
 * @param response
 * @return
 */
Deploy.prototype._onDeployEvent = function(channel, watch, response) {
  var values,
      self = this;

  channel = path.basename(watch.key);
  if (!channel) {
    log.error('channel is undefined')
    return;
  }

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
    log.info('deploy succeeded', { channel: channel, version: values.version });
  });
};


Deploy.prototype.startWatcher = function(channel) {
  var key = this.generateDeployKey(channel),
      client = new etcd.Client(this.options.etcd_host, this.options.etcd_port),
      watch;

  if (this.watchers[key]) {
    return;
  }

  watch = client.watcher(key);
  watch.on('change', _.bind(this._onDeployEvent, this, channel, watch));
  this.watchers[key] = watch;
};


/**
 * _startWatchers
 *
 * @param callback
 * @return
 */
Deploy.prototype._startWatchers = function(callback) {
  log.info('Starting Watchers');
  _.each(this._channels, _.bind(this.startWatcher, this));
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
      return;
    }
    self._channels = results;
    callback(null, self._channels);
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
  log.info('Verifying local channel downloads:');
  _.each(unique_versions, function(version) {
    log.infof(' ' + version);
  });
  async.eachLimit(unique_versions, 5, this._download.bind(this), function(err) {
    if (!err) {
      log.info('All channels downloaded and ready');
    }
    callback(err);
  });
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
    check_for_deploys: ['channels', 'watchers', function(callback, results) {
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

Deploy.prototype._createChannels = function(callback) {
  var self = this,
    etcdClient = new etcd.Client(self.options.etcd_host, self.options.etcd_port);

  function iter(channel, callback) {
    var path = '/deploys/' + channel,
        create = false;

    if (!channel) {
      log.error('channel is undefined');
      callback();
      return;
    }

    async.series([
      function(callback) {
        etcdClient.get(path, function(err) {
          if (err) {
            create = true;
            callback();
          } else {
            callback();
          }
        });
      },
      function(callback) {
        if (create) {
          log.info('Creating channel: ' + channel);
          etcdClient.set(path, JSON.stringify({version: self.options.default_channel_version}), callback);
        } else {
          callback();
        }
      }
    ], callback);
  }
  async.series([
    function(callback) {
      etcdClient.mkdir('/deploys', function(err) {
        if (err) {
          log.info('mkdir failed creating /deploys', {err: err});
        }
        callback();
      });
    },
    function(callback) {
      async.forEach(self.options.default_channels, iter, callback);
    }
  ], callback);
};

Deploy.prototype.createDefaultChannels = function(callback) {
  var etcdClient = new etcd.Client(this.options.etcd_host, this.options.etcd_port),
      lockKey = 'virgo_creation_lock',
      global = new Global(),
      self = this;

  function perform(lock, callback) {
    async.series([
      function(callback) {
        global.getChannels(function(err) {
          if (err) {
            self._createChannels(callback);
          } else {
            callback();
          }
        });
      }
    ], callback);
  }
  etcdClient.lock(lockKey, 30, perform, callback);
};


function FileDeploy(options) {
  Deploy.call(this, options);
}
util.inherits(FileDeploy, Deploy);

FileDeploy.prototype._download = function(version, callback) {
  callback();
};


function create(name, options) {
  switch(name.toLowerCase()) {
  case 'file':
    return new FileDeploy(options);
  default:
    return new Deploy(options);
  }  
}


exports.Deploy = Deploy;
exports.create = create;
