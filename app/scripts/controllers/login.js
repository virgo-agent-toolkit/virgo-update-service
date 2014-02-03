var upgradeApp = angular.module('upgradeApp');

upgradeApp.controller('LoginController', function($scope, $http, UpgradeService, $location, $window) {
  $scope.user = {};
  $scope.submit = function() {
    $http
      .post('/authenticate', $scope.user)
        .success(function(data, status, headers, config) {
          $window.sessionStorage.token = data.token;
          $window.sessionStorage.user = $scope.user.username;
          $location.path('/main');
        }).error(function(data) {
          $scope.message = data;
          // Erase the token if the user fails to log in
          delete $window.sessionStorage.token;
        });
  };
});
