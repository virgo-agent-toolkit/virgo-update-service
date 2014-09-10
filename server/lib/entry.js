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
var sprintf = require('sprintf').sprintf;
var url = require('url');
var _ = require('underscore');


var log = require('logmagic').local('virgo-upgrade-service.lib.entry');

var logmagic = require('logmagic');
logmagic.route('__root__', logmagic['DEBUG'], 'console');


function die(msg) {
  console.log(msg);
  process.exit(1);
}


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
      value,
      l;

  /* required options */
  options.etcd_host = process.env.VIRGO_UPDATE_SERVICE_ETCD_HOST;
  if (!options.etcd_host) {
    die('VIRGO_UPDATE_SERVICE_ETCD_HOST is missing');
  }
  options.etcd_port = process.env.VIRGO_UPDATE_SERVICE_ETCD_PORT;
  if (!options.etcd_port) {
    die('VIRGO_UPDATE_SERVICE_ETCD_PORT is missing');
  }
  options.bind_host = process.env.VIRGO_UPDATE_SERVICE_BIND_HOST;
  if (!options.bind_host) {
    die('VIRGO_UPDATE_SERVICE_BIND_HOST is missing');
  }
  options.bind_port = process.env.VIRGO_UPDATE_SERVICE_BIND_PORT;
  if (!options.bind_port) {
    die('VIRGO_UPDATE_SERVICE_BIND_PORT is missing');
  }
  options.secret = process.env.VIRGO_UPDATE_SERVICE_SECRET;
  if (!options.secret) {
    die('VIRGO_UPDATE_SERVICE_SECRET is missing');
  }
  options.htpasswd_file = process.env.VIRGO_UPDATE_SERVICE_HTPASSWD_FILE;
  if (!options.htpasswd_file) {
    die('VIRGO_UPDATE_SERVICE_HTPASSWD_FILE is missing');
  }
  options.default_channels = process.env.VIRGO_UPDATE_SERVICE_DEFAULT_CHANNELS;
  if (!options.default_channels) {
    die('VIRGO_UPDATE_SERVICE_DEFAULT_CHANNELS is missing');
  } else {
    options.default_channels = options.default_channels.split(',');
  }
  options.default_channel_version = process.env.VIRGO_UPDATE_SERVICE_DEFAULT_CHANNEL_VERSION;
  if (!options.default_channel_version) {
    die('VIRGO_UPDATE_SERVICE_DEFAULT_CHANNEL_VERSION is missing');
  }
  options.pkgbackend = process.env.VIRGO_UPDATE_PACKAGE_BACKEND;
  if (!options.pkgbackend) {
    options.pkgbackend = 'pkgcloud';;
  }
  options.pkgcloud.username = process.env.VIRGO_UPDATE_SERVICE_PKGCLOUD_USERNAME;
  if (options.pkgbackend === 'pkgcloud' && !options.pkgcloud.username) {
    die('VIRGO_UPDATE_SERVICE_PKGCLOUD_USERNAME is missing');
  }
  options.pkgcloud.apiKey = process.env.VIRGO_UPDATE_SERVICE_PKGCLOUD_APIKEY;
  if (options.pkgbackend === 'pkgcloud' && !options.pkgcloud.apiKey) {
    die('VIRGO_UPDATE_SERVICE_PKGCLOUD_APIKEY is missing');
  }
  value = process.env.VIRGO_UPDATE_SERVICE_EXE_DIR;
  if (value) {
    options.exe_dir = value;
  }
  value = process.env.VIRGO_UPDATE_VERSION_CACHE_TTL;
  if (value) {
    options.version_cache_timeout = value.parseInt();
  }

  /* optional options */
  value = process.env.VIRGO_UPDATE_SERVICE_PUBLIC_HOST;
  if (value) {
    options.addr_host = value;
  } else {
    options.addr_host = options.bind_host;
  }
  value = process.env.VIRGO_UPDATE_SERVICE_PUBLIC_PORT;
  if (value) {
    options.addr_port =  value;
  } else {
    options.addr_port = options.bind_port;
  }
  value = process.env.VIRGO_UPDATE_SERVICE_NAME;
  if (value) {
    options.service_name = value;
  }

  function optionsMiddleware(req, res, next) {
    req.globalOptions = options;
    req.authDb = authDb;
    next();
  }

  etcd.setEndpoints(options.etcd_host + ':' + options.etcd_port);
  authDb = auth.loadDBFromFile(options.htpasswd_file);

  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.static(path.join(__dirname, '..', '..', 'app')));
  app.use('/exe', express.directory(options.exe_dir));
  app.use('/exe', express.static(options.exe_dir));
  app.use(optionsMiddleware);
  api.register(options, server, app);

  de = new deploy.create(options.pkgbackend, options);
  options.deploy_instance = de;

  log.infof('Using etcd ${host}:${port}', {host: options.etcd_host, port: options.etcd_port});
  log.infof('Listening on ${host}:${port}', {host: options.bind_host, port: options.bind_port});

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
      services = registry(options.etcd_host + ':' + options.etcd_port);
      services.join(options.service_name, { hostname: options.addr_host, port: options.addr_port });
      callback();
    }],
    create: ['register', function(callback) {
      log.infof('Checking for default channels', {channels: options.default_channels});
      de.createDefaultChannels(callback);
    }],
    deploy: ['create', function(callback) {
      de.run(callback);
    }],
    listen: ['deploy', function(callback) {
      server.listen(options.bind_port, options.bind_host, callback);
    }]
  }, function(err) {
    if (err) {
      log.errorf("error", {err: err});
      process.exit(1);
    }  
    log.info('running');
  });
}

exports.entry = entry;
