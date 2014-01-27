var express = require('express');
var service = require('./service')
var api = require('./api');
var logger = require('./logger').logger;
var path = require('path');

function entry(options) {
  var app = express();

  function optionsMiddleware(req, res, next) {
    req.globalOptions = options;
    next();
  }

  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.static(path.join(__dirname, '..', '..', 'app')));
  app.use(optionsMiddleware);
  api.register(app);

  app.listen(options.listen_port, options.listen_host, function(err) {
    if (err) {
      return;
    }
    logger.info('Listening on %s:%s', options.listen_host, options.listen_port)
  });
}

exports.entry = entry;
