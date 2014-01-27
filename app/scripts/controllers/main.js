var controllers = angular.module('upgradeAppControllers', ['upgradeAppServices']);

controllers.controller('MainController', function($scope, UpgradeService) {
  UpgradeService.getAvailableVersions().then(function(data) {
    $scope.versions = data;
  });
});

