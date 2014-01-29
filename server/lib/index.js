var express = require('express');
var service = require('./service')
var api = require('./api');
var logger = require('./logger').logger;
var path = require('path');
var io = require('socket.io');
var http = require('http');

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
      server = http.createServer(app);

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

  server.listen(options.listen_port, options.listen_host, function(err) {
    if (err) {
      return;
    }
    logger.info('Listening on %s:%s', options.listen_host, options.listen_port)
  });
}

exports.entry = entry;
