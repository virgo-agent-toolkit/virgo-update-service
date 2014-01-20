var express = require('express');
var service = require('./service')
var api = require('./api');

function entry(options) {
  var app = express();

  // API
  api.register(app);

  app.listen(options.port, function(err) {
    if (err) {
      return;
    }
    service.register(options);
  });
}

exports.entry = entry;
