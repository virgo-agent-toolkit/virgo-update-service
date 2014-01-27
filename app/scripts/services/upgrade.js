var module = angular.module('upgradeAppServices', []);
var service = function($http) {
  var s = {};
  s.getAvailableVersions = function() {
    return $http.get('/v1/available_versions').
      then(function(result) {
        return result.data;
      });
  };
  s.startDeploy = function(channel, version) {

  };
  return s;
};
module.factory('UpgradeService', service);
