var module = angular.module('upgradeAppServices', []);
var service = function($http) {
  var s = {};
  s.getAvailableVersions = function() {
    return $http.get('/v1/available_versions');
  };
  s.deploy = function(channel, version) {
    return $http({
      method: 'POST',
      url: '/v1/deploy',
      data: $.param({'channel': channel.toLowerCase(), 'version': version}),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  };
  return s;
};
module.factory('UpgradeService', service);
