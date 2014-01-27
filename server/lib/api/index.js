var pkgcloud = require('pkgcloud');
var logger = require('../logger');
var _ = require('underscore');

function availableVersions(req, res) {
  var client = pkgcloud.storage.createClient(req.globalOptions.pkgcloud);
  client.getContainers(function(err, containers) {
    if (err) {
      logger.error(err);
      res.send(500, err.message);
      return;
    }
    var results = [];
    _.each(containers, function(c) {
      if (/^[0-9.\-]+$/.test(c.name)) {
        results.push(c.name);
      }
    });
    res.json(results.sort().reverse());
  });
}


exports.register = function(app) {
  // v1
  var v1prefix = '/v1';
  app.get(v1prefix + '/available_versions', availableVersions);
};
