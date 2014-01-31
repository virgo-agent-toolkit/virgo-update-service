var upgradeApp = angular.module('upgradeApp');

upgradeApp.controller('MainController', function($scope, UpgradeService, $location) {
  $scope.deployData = {};

  $scope.isUnchanged = function(data) {
    return data.version === undefined || data.channel === undefined;
  };

  UpgradeService.getAvailableVersions().success(function(msg) {
    $scope.availableVersions = msg;
  });

  UpgradeService.getServiceNodes().success(function(data) {
    $scope.servers = data;
  });

  $scope.deploy = function() {
    UpgradeService.deploy($scope.deployData)
      .success(function() {
        $location.path('/deploy');
      });
  };
});
