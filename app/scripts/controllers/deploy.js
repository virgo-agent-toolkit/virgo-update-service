var upgradeApp = angular.module('upgradeApp');

upgradeApp.controller('DeployController', function($scope, WebSocket) {
  $scope.data = [];
  WebSocket.on('line', function(line) {
    $scope.data.push(line);
  });
});
