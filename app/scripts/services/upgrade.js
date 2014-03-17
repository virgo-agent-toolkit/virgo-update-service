var module = angular.module('upgradeAppServices', []);
module.factory('UpgradeService', function($http) {
  return {
    getServiceNodes: function() {
      return $http.get('/v1/nodes');
    },
    getAvailableRemoteVersions: function() {
      return $http.get('/v1/versions/remote');
    },
    getAvailableLocalVersions: function() {
      return $http.get('/v1/versions/local');
    },
    getAvailableChannelVersions: function() {
      return $http.get('/v1/versions/channel');
    },
    getAvailableChannels: function() {
      return $http.get('/v1/channels');
    },
    getDeployStatus: function() {
      return $http.get('/v1/deploy/status');
    },
    deploy: function(deployData) {
      return $http.post('/v1/deploy', deployData);
    }
  };
});
