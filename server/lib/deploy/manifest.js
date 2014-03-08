var _ = require('underscore');
var async = require('async');
var fs = require('fs');
var path = require('path');
var log = require('logmagic').local('virgo-upgrade-service.lib.deploy.manifest');

var DEFAULT_FILENAME = 'manifest.json';
var DEFAULT_DATA_DIR = '/data';

/**
 * Manifest
 *
 * @param options
 * @return
 */
function Manifest(options) {
  options = options || {};
  this.options = _.defaults(options, {
    manifest_filename: DEFAULT_FILENAME,
    data_dir: DEFAULT_DATA_DIR
  });
}


/**
 * _getFilePath
 *
 * @return
 */
Manifest.prototype._getFilePath = function() {
  return path.join(this.options.data_dir, this.options.manifest_filename);
};


/**
 * read
 *
 * @param callback
 * @return
 */
Manifest.prototype.read = function(callback) {
  fs.readFile(this._getFilePath(), function(err, data) {
    if (err) {
      callback(null, {});
      return;
    }
    try {
      callback(null, JSON.parse(data));
    } catch (e) {
      callback(e);
    }
  });
};


/**
 * save
 *
 * @param version
 * @param callback
 * @return
 */
Manifest.prototype.save = function(version, callback) {
  var self = this;
  async.auto({
    manifest: function(callback) {
      self.read(callback);
    },
    write: ['manifest', function(callback, results) {
      if (!results.manifest.versions) {
        results.manifest.versions = [];
      }
      results.manifest.versions.push(version);
      fs.writeFile(self._getFilePath(), JSON.stringify(results.manifest), callback);
    }
  ]}, callback);
};


/** Export Manifest */
exports.Manifest = Manifest;
