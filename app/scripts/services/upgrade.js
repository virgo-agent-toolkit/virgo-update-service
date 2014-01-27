var module = angular.module('upgradeAppServices', []);
var service = function($http) {
  var s = {};
  s.getAvailableVersions = function() {
    return $http.get('/v1/pkgcloud/available_versions').
      then(function(result) {
        return result.data;
      });
  };
  return s;
};
module.factory('UpgradeService', service);
