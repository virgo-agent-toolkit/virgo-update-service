var module = angular.module('upgradeAppServices', []);
var service = function($http) {
  var s = {};
  s.getAvailableVersions = function() {
    return $http.get('/v1/available_versions');
  };
  s.deploy = function(deployData) {
    return $http.post('/v1/deploy', deployData);
  };
  return s;
};
module.factory('UpgradeService', service);
