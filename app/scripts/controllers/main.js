var upgradeApp = angular.module('upgradeApp');

upgradeApp.controller('MainController', function($scope, UpgradeService, $location) {
  $scope.deployData = {};

  UpgradeService.getAvailableVersions().success(function(data) {
    $scope.versions = data;
  });

  $scope.deploy = function() {
    UpgradeService.deploy($scope.deployData.channel,
                          $scope.deployData.version).success(function() {
                            $location.path('/deploy');
                          });
  };
});

