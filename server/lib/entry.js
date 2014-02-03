var api = require('./api');
var express = require('express');
var http = require('http');
var logger = require('./logger').logger;
var path = require('path');
var registry = require('etcd-registry');
var url = require('url');
var _ = require('underscore');

function entry(options) {
  var app = express(),
      server = http.createServer(app),
      services;

  function optionsMiddleware(req, res, next) {
    req.globalOptions = options;
    next();
  }

  // coerce commandline arguments to comma delimited string
  if (options.argv.peers) {
    if (typeof(options.argv.peers) === 'object') {
      options.etcd_hosts = options.argv.peers.join(',');
    } else {
      options.etcd_hosts = options.argv.peers;
    }
  }
  if (options.argv['bind-addr']) {
    var l = options.argv['bind-addr'].split(':');
    options.listen_host = l[0];
    options.listen_port = l[1];
  }
  if (options.argv.a) {
    options.pkgcloud.apiKey = options.argv.a;
  }
  if (options.argv.u) {
    options.pkgcloud.username = options.argv.u;
  }
  if (options.argv.s) {
    options.secret = options.argv.s;
  }

  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.static(path.join(__dirname, '..', '..', 'app')));
  app.use(optionsMiddleware);
  api.register(options, server, app);

  services = registry(options.etcd_hosts);
  services.join(options.service_name, {
    port: options.listen_port
  });

  server.listen(options.listen_port, options.listen_host, function(err) {
    if (err) {
      logger.error('error listening', err.message);
      return;
    }
    logger.info('Using etcd hosts: %s', options.etcd_hosts);
    logger.info('Listening on %s:%s', options.listen_host, options.listen_port)
  });
}

exports.entry = entry;
