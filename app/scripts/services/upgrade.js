var module = angular.module('upgradeAppServices', []);
module.factory('UpgradeService', function($http) {
  return {
    getAvailableVersions: function() {
      return $http.get('/v1/available_versions');
    },
    deploy: function(deployData) {
      return $http.post('/v1/deploy', deployData);
    }
  };
});
