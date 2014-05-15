var auth= require('../auth');
var async = require('async');
var etcd = require('../etcd');
var expressJwt = require('express-jwt');
var fs = require('fs');
var path = require('path');
var io = require('socket.io');
var jwt = require('jsonwebtoken');
var messages = require('./messages');
var pkgcloud = require('pkgcloud');
var registry = require('etcd-registry');
var socketioJwt = require('socketio-jwt');
var _ = require('underscore');

var Deploy = require('../deploy').Deploy;

var log = require('logmagic').local('virgo-upgrade-service.lib.api');

var clients = {};

function getSocketKey(socket) {
  return socket.handshake.query.token.slice(0, 24);
}

function onConnection(socket) {
  var key = getSocketKey(socket),
      d = new Deploy(socket.globalOptions);

  d.on('line', function(line) {
    socket.emit('line', line);
  });

  clients[key] = d;

  socket.on('disconnect', function () {
    log.debug('Client Disconnected', key);
    delete clients[key];
  });
}

function _availableLocalVersions(req, res) {
  var base_dir = req.globalOptions.exe_dir;
  async.auto({
    'readdir': function(callback) {
      fs.readdir(base_dir, callback);
    },
    'filtered': ['readdir', function(callback, results) {
      var versions = _.filter(results.readdir, function(dir) {
        return fs.lstatSync(path.join(base_dir, dir)).isDirectory();
      });
      callback(null, versions);
    }]
  }, function(err, results) {
    if (err) {
      res.json(new messages.ErrorResponse(err));
    } else {
      res.json(new messages.Response(results.filtered.reverse()));
    }
  });
}

function _currentDeploys(req, res) {
  res.json({});
}

function _availableRemoteVersions(req, res) {
  var cl = new etcd.Client(),
      cacheKey = '/cache/remoteVersions';

  function work(callback) {
    var client = pkgcloud.storage.createClient(req.globalOptions.pkgcloud);
    client.getContainers(function(err, containers) {
      if (err) {
        callback(err);
        return;
      }
      var results = _.pluck(containers, 'name')
        .filter(function(name) {
          return (/^[0-9.\-]+$/).test(name);
        })
        .sort()
        .reverse();
      callback(null, results);
    });
  }

  cl.cache(cacheKey, 5 * 60, work, function(err, results) {
    if (err) {
      res.json(new messages.ErrorResponse(err));
    } else {
      res.json(new messages.Response(results));
    }
  });
}

function _nodes(req, res) {
  var hosts = req.globalOptions.etcd_hosts.replace(/.*?:\/\//g, ""),
      reg = registry(hosts);

  reg.list(req.globalOptions.service_name, function(err, s) {
    if (err) {
      res.json(new messages.ErrorResponse(err));
    } else {
      res.json(new messages.Response(s));
    }
  });
}

function _deploy(req, res) {
  var cl = new etcd.Client(),
      key,
      payload,
      de = req.globalOptions.deploy_instance;

  if (req.body.newChannelName) {
    req.body.channel = req.body.newChannelName;
    de._startWatcher(req.body.channel);
  }
  
  key = '/deploys/' + req.body.channel;
  payload = { value: JSON.stringify({ version: req.body.version }) };
  cl.set(key, payload, function(err) {
    if (err) {
      res.json(new messages.ErrorResponse(err));
    } else {
      res.json(new messages.Response());
    }
  });
}

function _authenticate(req, res) {
  req.authDb.validate(req.body.username, req.body.password, function(err, validated) {
    var profile, token;

    if (err) {
      res.send(401, 'Wrong user or password');
      return;
    }
    if (!validated) {
      res.send(401, 'Wrong user or password');
      return;
    }

    // We are sending the profile inside the token
    profile = { username: req.body.username };
    token = jwt.sign(profile, req.globalOptions.secret, {});
    res.json({ token: token });
  });

}

function _availableChannelVersions(req, res) {
  var de = req.globalOptions.deploy_instance;
  de.getLatestChannelsVersion(function(err, versions) {
    if (err) {
      res.json(new messages.ErrorResponse(err));
    } else {
      if (req.params.name) {
        versions = _.pick(versions, req.params.name);
      }
      if (_.keys(versions).length === 0) {
        res.json(new messages.ErrorResponse(new Error('no such channel')));
        return;
      }
      res.json(new messages.Response(versions));
    }
  });
}

function _availableChannels(req, res) {
  var de = req.globalOptions.deploy_instance;
  de.getChannels(function(err, channels) {
    if (err) {
      res.json(new messages.ErrorResponse(err));
    } else {
      res.json(new messages.Response(channels));
    }
  });
}


function _deployStatus(req, res) {
  var de = req.globalOptions.deploy_instance;
  de.getDeployStatus(function(err, stats) {
    if (err) {
      res.json(new messages.ErrorResponse(err));
    } else {
      res.json(new messages.Response(stats));
    }
  });
}


exports.register = function(options, server, app) {
  var PREFIX = '/v1';

  io = io.listen(server);
  io.set('authorization', socketioJwt.authorize({
    secret: options.secret,
    handshake: true
  }));
  io.on('connection', function(socket) {
    socket.globalOptions = options;
    onConnection(socket);
  });

  // v1
  app.post('/authenticate', _authenticate);
  app.get(PREFIX + '/versions/channel/:name', _availableChannelVersions);
  app.get(PREFIX + '/versions/channel', _availableChannelVersions);
  app.get(PREFIX + '/versions/remote', _availableRemoteVersions);
  app.get(PREFIX + '/versions/local', _availableLocalVersions);
  app.get(PREFIX + '/channels', _availableChannels);
  app.get(PREFIX + '/nodes', _nodes);
  app.use(PREFIX + '/deploy', expressJwt({secret: options.secret}));
  app.post(PREFIX + '/deploy', _deploy);
  app.get(PREFIX + '/deploy/status', _deployStatus);
};

