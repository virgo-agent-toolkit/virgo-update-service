var async = require('async');
var crypto = require('crypto');
var events = require('events');
var fs = require('fs');
var path = require('path');
var pkgcloud = require('pkgcloud');
var mkdirp = require('mkdirp');
var util = require('util');
var _  = require('underscore');

var log = require('logmagic').local('virgo-upgrade-service.lib.download');

var DEFAULT_CONCURRENCY = 10;


/**
 * Downloader
 *
 * @param options
 * @param concurrency
 * @return
 */
function Downloader(options, concurrency) {
  var self = this;
  events.EventEmitter.call(this);
  this.options = options;
  this.concurrency = concurrency;
  this.bucket = '<UNKNOWN>';
  this.q = async.queue(_.bind(self._download, self), concurrency);
  this.q.drain = _.bind(self.done, self);
}
util.inherits(Downloader, events.EventEmitter);


/**
 * setBucket
 *
 * @param bucket
 * @return
 */
Downloader.prototype.setBucket = function(bucket) {
  this.bucket = bucket;
};


/**
 * done
 *
 * @return
 */
Downloader.prototype.done = function() {
  this.emit('end');
};


/**
 * _getFilePath
 *
 * @param file
 * @return
 */
Downloader.prototype._getFilePath = function(file) {
  return path.join(this.options.exe_dir, this.bucket, file.name);
};


/**
 * push
 *
 * @param file
 * @return
 */
Downloader.prototype.push = function(file) {
  this.q.push(file);
};


/**
 * _download
 *
 * @param file
 * @param callback
 * @return
 */
Downloader.prototype._download = function(file, callback) {
  var self = this,
      local_path,
      perform_download = false;
  local_path = this._getFilePath(file);
  async.auto({
    'create_directory': function(callback) {
      var base_dir = path.dirname(local_path);
      if (fs.existsSync(base_dir)) {
        callback();
      } else {
        mkdirp(base_dir, callback);
      }
    },
    'validate': ['create_directory', function(callback, results) {
      if (!fs.existsSync(local_path)) {
        perform_download = true;
        callback();
      } else {
        var md5sum = crypto.createHash('md5'),
            s;
        s = fs.ReadStream(local_path);
        s.on('data', function(d) {
          md5sum.update(d);
        });
        s.on('end', function() {
          var d = md5sum.digest('hex');
          if (d === file.etag) {
            log.debug('Etag Matches', { name: file.name });
            perform_download = false;
          } else {
            perform_download = true;
            log.debug('Etag does not match', { name: file.name });
          }
          callback();
        });
      }
    }],
    'download': ['validate', function(callback) {
      var options = {
        container: file.container,
        remote: file.name
      }, stream;

      callback = _.once(callback);

      if (perform_download === false) {
        callback();
        return;
      }

      log.debug('Downloading', local_path);

      stream = fs.createWriteStream(local_path);
      file.client.download(options).pipe(stream);
      stream.on('error', function(err) {
        log.error('Error downloading', file.name, err);
        setTimeout(function() {
          self.push(file); 
        } , 5000);
        callback();
      });
      stream.on('close', function() {
        log.info('Downloaded', local_path);
        callback();
      });
    }]
  }, callback);
};

/**
 * bucket
 *
 * @param options
 * @param name
 * @return
 */
function bucket(options, name) {
  var client, concurrency, dl;

  dl = new Downloader(options);
  dl.setBucket(name);
  concurrency = concurrency || DEFAULT_CONCURRENCY;
  client = pkgcloud.storage.createClient(options.pkgcloud);

  async.auto({
    'files': function(callback) {
      client.getFiles(name, callback);
    },
    'download': ['files', function(callback, results) {
      _.each(results.files, function(file) {
        if (!file || !file.name) return;
        dl.push(file);
      });
      callback();
    }]
  }, function(err) {
    if (err) {
      dl.emit('error', err);
    }
  });

  return dl;
}


/** Export Bucket */
exports.bucket = bucket;
