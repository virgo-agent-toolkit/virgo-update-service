var _ = require('underscore');
var async = require('async');
var etcd = require('../etcd');
var path = require('path');
var util = require('util');


function NoDeployError() {
  Error.call(this);
  this.message = 'No Deploys';
}
util.inherits(NoDeployError, Error);


function Global(client) {
  this.etcd = client || etcd.createClient();
}


Global.prototype.getChannels = function(callback) {
  var channels,
      self = this;

  self.etcd.get('/deploys', 0, function(err, resp) {
    if (err) {
      callback(err);
      return;
    }
    if (!resp) {
      callback(null, []);
      return;
    }
    channels = _.map(resp.node.nodes, function(node) {
      return path.basename(node.key);
    });
    callback(null, channels);
  });
};

function _parseVersionResponse(resp, callback) {
  var parsed;
  try {
    parsed = JSON.parse(resp.node.value);
  } catch (try_err) {
    callback(try_err);
    return;
  }
  callback(null, parsed.version);
}


Global.prototype.getChannelVersions = function(channel_name, callback) {
  var next,
      createdIndex,
      versions = [],
      self = this;

  function test() {
    return next !== undefined;
  }

  function iter(callback) {
    self.etcd.get('/deploys/' + channel_name, 0, function(err, resp) {
      if (err) {
        callback(err);
        return;
      }
      if (!resp) {
        callback(new NoDeployError());
        return;
      }
      if (!createdIndex) {
        createdIndex = resp.node.createdIndex;
        next = createdIndex;
      } else if (createdIndex === resp.node.createdIndex) {
        next = undefined;
        callback();
        return;
      }

      _parseVersionResponse(resp, function(err, version) {
        if (!err) {
          versions.push(version);
        }
        callback();
      });
    });
  }

  async.doWhilst(iter, test, function(err) {
    callback(err, _.uniq(versions));
  });
};

Global.prototype.getLatestChannelVersion = function(channel_name, callback) {
  this.etcd.get('/deploys/' + channel_name, 0, function(err, resp) {
    if (err) {
      callback(err);
      return;
    }

    if (!resp) {
      callback(new NoDeployError());
      return;
    }

    _parseVersionResponse(resp, callback);
  });
};


exports.Global = Global;
