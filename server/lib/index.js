var express = require('express');
var service = require('./service')
var api = require('./api');
var logger = require('./logger').logger;
var path = require('path');

function entry(options) {
  var app = express();

  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.static(path.join(__dirname, '..', '..', 'app')));
  app.use(app.router);

  app.listen(options.listen_port, options.listen_host, function(err) {
    if (err) {
      return;
    }
    logger.info('Listening on %s:%s', options.listen_host, options.listen_port)
    service.register(options);
  });
}

exports.entry = entry;
