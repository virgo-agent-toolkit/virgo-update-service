var api = require('./api');
var express = require('express');
var http = require('http');
var io = require('socket.io');
var logger = require('./logger').logger;
var path = require('path');
var registry = require('etcd-registry');

function connection(socket) {
  function go() {
    socket.emit('line', 'test');
    setTimeout(go, 1000);
  }
  setTimeout(go, 1000);
  socket.on('disconnect', function () {
    console.log('Client Disconnected');
  });
}

function entry(options) {
  var app = express(),
      server = http.createServer(app),
      services;

  function optionsMiddleware(req, res, next) {
    req.globalOptions = options;
    next();
  }

  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.static(path.join(__dirname, '..', '..', 'app')));
  app.use(optionsMiddleware);
  api.register(app);

  io = io.listen(server);
  io.sockets.on('connection', connection);

  services = registry(options.etcd_hosts);
  services.join(options.service_name, {
    port: options.listen_port,
    hostname: options.listen_host
  });

  server.listen(options.listen_port, options.listen_host, function(err) {
    if (err) {
      return;
    }
    logger.info('Listening on %s:%s', options.listen_host, options.listen_port)
  });
}

exports.entry = entry;
