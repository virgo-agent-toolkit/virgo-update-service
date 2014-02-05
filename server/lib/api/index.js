var pkgcloud = require('pkgcloud');
var messages = require('./messages');
var registry = require('etcd-registry');
var jwt = require('jsonwebtoken');
var expressJwt = require('express-jwt');
var socketioJwt = require('socketio-jwt');
var auth= require('../auth');
var io = require('socket.io');
var _ = require('underscore');

var log = require('logmagic').local('virgo-upgrade-service.lib.api');

function connection(socket) {
  socket.on('disconnect', function () {
    log.info('Client Disconnected');
  });
}

function availableVersions(req, res) {
  var client = pkgcloud.storage.createClient(req.globalOptions.pkgcloud),
      results;
  client.getContainers(function(err, containers) {
    if (err) {
      return res.json(messages.ErrorResponse(err));
    }
    results = _.pluck(containers, 'name').filter(function(name) {
      return (/^[0-9.\-]+$/).test(name);
    }).sort().reverse();
    res.json(new messages.Response(results));
  });
}

function nodes(req, res) {
  var reg = registry(req.globalOptions.etcd_hosts);

  reg.list(req.globalOptions.service_name, function(err, s) {
    if (err) {
      return res.json(messages.ErrorResponse(err));
    }
    res.json(new messages.Response(s));
  });
}

function deploy(req, res) {
  res.json({});
}

function authenticate(req, res) {
  var profile, token;

  req.authDb.validate(req.body.username, req.body.password, function(err, validated) {
    if (err) {
      res.send(401, 'Wrong user or password');
      return;
    }
    if (!validated) {
      res.send(401, 'Wrong user or password');
      return;
    }

    // We are sending the profile inside the token
    profile = {
      username: req.body.username
    };
    token = jwt.sign(profile, req.globalOptions.secret, {});
    res.json({ token: token });
  });

}

exports.register = function(options, server, app) {
  var PREFIX = '/v1';

  io = io.listen(server);
  io.set('authorization', socketioJwt.authorize({
    secret: options.secret,
    handshake: true
  }));
  io.on('connection', connection);

  // v1
  app.post('/authenticate', authenticate);
  app.use(PREFIX, expressJwt({secret: options.secret}));
  app.get(PREFIX + '/available_versions', availableVersions);
  app.get(PREFIX + '/nodes', nodes);
  app.post(PREFIX + '/deploy', deploy);
};

