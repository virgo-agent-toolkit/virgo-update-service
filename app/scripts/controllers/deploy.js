var upgradeApp = angular.module('upgradeApp');

upgradeApp.controller('DeployController', function($scope, WebSocket) {
  $scope.data = [];
  $scope.$on('$destroy', function(){
    WebSocket.close();
  });
  WebSocket.on('line', function(line) {
    $scope.data.push(line);
  });
});
