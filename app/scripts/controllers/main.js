var controllers = angular.module('upgradeAppControllers', []);

controllers.controller('MainController', function($scope) {
  $scope.versions = ['1.2.3', '1.2.4']
});

