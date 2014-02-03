var async = require('async');
var fs = require('fs');
var path = require('path');
var pkgcloud = require('pkgcloud');
var mkdirp = require('mkdirp');
var _  = require('underscore');

var log = require('logmagic').local('virgo-upgrade-service.lib.pkgcloud.download_bucket');

var DEFAULT_CONCURRENCY = 10;

function getLocalPath(base, filename) {
  return path.join(base, filename);
}

function download(file, callback) {
  log.debug('Downloading', file.name);
  var local_path = getLocalPath(file.name);
  async.series([
    function createDirectory(callback) {
      var base_dir = path.dirname(local_path);
      if (path.existsSync(base_dir)) {
        callback();
      } else {
        mkdirp(base_dir, callback);
      }
    },
    function download(callback) {
      var options = {
        container: file.container,
        remote: file.name
      }, stream;
      callback = _.once(callback);
      stream = fs.createWriteStream(local_path);
      file.client.download(options).pipe(stream);
      stream.on('error', function(err) {
        log.error('Error downloading', file.name, err);
        callback(err);
      });
      stream.on('close', function() {
        log.info('Downloaded', local_path);
        callback();
      });
    }
  ], callback);
}

/**
  * @param {Object} pkgcloud_options The Options.
  * @param {String} bucket The bucket name.
  */
function downloadBucket(pkgcloud_options, bucket, callback) {
  var client, q, concurrency;

  callback = _.once(callback);

  concurrency = concurrency || DEFAULT_CONCURRENCY;
  client = pkgcloud.storage.createClient(pkgcloud_options);
  q = async.queue(download, concurrency);
  q.done = callback;

  client.getFiles(bucket, function(err, files) {
    if (err) {
      callback(err);
      return;
    }
    if (files.length === 0) {
      callback(new Error('Container is empty'));
      return;
    }
    _.each(files, function(file) {
      log.debug('Adding file to queue', file.name);
      q.push(file, function(err) {
        if (err) {
          log.error('Download failed', file.name);
        }
      });
    });
  });
}

exports.downloadBucket = downloadBucket;
