var pkgcloud = require('pkgcloud');
var logger = require('../logger');
var registry = require('etcd-registry');
var _ = require('underscore');

function availableVersions(req, res) {
  var client = pkgcloud.storage.createClient(req.globalOptions.pkgcloud);
  client.getContainers(function(err, containers) {
    if (err) {
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

function nodes(req, res) {
  var reg = registry(req.globalOptions.etcd_hosts);

  reg.list(req.globalOptions.service_name, function(err, s) {
    if (err) {
      return;
    }
    res.json(s);
  });
}

function deploy(req, res) {
  res.json({});
}


exports.register = function(app) {
  // v1
  var PREFIX = '/v1';
  app.get(PREFIX + '/available_versions', availableVersions);
  app.get(PREFIX + '/nodes', nodes);
  app.post(PREFIX + '/deploy', deploy);
};
