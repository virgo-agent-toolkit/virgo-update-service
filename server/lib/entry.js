var api = require('./api');
var async = require('async');
var auth = require('./auth');
var deploy = require('./deploy');
var etcd = require('./etcd');
var express = require('express');
var http = require('http');
var mkdirp = require('mkdirp');
var path = require('path');
var registry = require('etcd-registry');
var url = require('url');
var _ = require('underscore');


var log = require('logmagic').local('virgo-upgrade-service.lib.entry');

var logmagic = require('logmagic');
logmagic.route('__root__', logmagic['DEBUG'], 'console');


/**
 * @param options
 * @return 
 */
function entry(options) {
  var app = express(),
      server = http.createServer(app),
      services,
      authDb,
      de,
      l;

  function optionsMiddleware(req, res, next) {
    req.globalOptions = options;
    req.authDb = authDb;
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
  if (options.argv.b) {
    l = options.argv.b.split(':');
    options.bind_host = l[0];
    options.bind_port = l[1];
  }
  if (options.argv.r) {
    l = options.argv.r.split(':');
    options.addr_host = l[0];
    options.addr_port = l[1];
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
  if (options.argv.t) {
    options.htpasswd_file = options.argv.t;
  }
  if (options.argv.n) {
    options.service_name = options.argv.n;
  }
  if (!options.addr_host) {
    options.addr_host = options.bind_host;
  }
  if (!options.addr_port) {
    options.addr_port = options.bind_port;
  }

  authDb = auth.loadDBFromFile(options.htpasswd_file);

  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.static(path.join(__dirname, '..', '..', 'app')));
  app.use('/exe', express.directory(options.exe_dir));
  app.use('/exe', express.static(options.exe_dir));
  app.use(optionsMiddleware);
  api.register(options, server, app);

  de = new deploy.Deploy(options);
  options.deploy_instance = de;

  async.auto({
    makedirs: function(callback) {
      function iter(dir, callback) {
        mkdirp(dir, function() {
          callback();
        })
      }
      async.forEach([options.data_dir, options.exe_dir], iter, callback);
    },
    register: ['makedirs', function(callback) {
      var services, et, etcd_hosts = options.etcd_hosts.replace(/.*?:\/\//g, ""),

      services = registry(etcd_hosts);
      services.join(options.service_name, {
        hostname: options.addr_host,
        port: options.addr_port
      });

      et = new etcd.Client({urls: options.etcd_hosts});
      et.refresh();
      et.once('machines', function() {
        callback();
      });
    }],
    listen: ['register', function(callback) {
      server.listen(options.bind_port, options.bind_host, function(err) {
        if (err) {
          log.error('error listening', err.message);
          callback(err);
          return;
        }
        log.infof('Using etcd hosts: ${hosts}', {hosts: options.etcd_hosts});
        log.infof('Listening on ${host}:${port}', {host: options.bind_host, port: options.bind_port});

        de.run(callback);
      });
    }]
  });
}

exports.entry = entry;
