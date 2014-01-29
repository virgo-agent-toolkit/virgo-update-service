var upgradeApp = angular.module('upgradeApp', [
  'btford.socket-io',
  'ngRoute',
  'upgradeAppWebSocket',
  'upgradeAppServices'
]);

upgradeApp.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/', {
    templateUrl: 'views/main.html',
    controller: 'MainController'
  })
  .when('/deploy', {
    templateUrl: 'views/deploy.html',
    controller: 'DeployController'
  })
  .otherwise({
    redirectTo: '/'
  });
}]);
