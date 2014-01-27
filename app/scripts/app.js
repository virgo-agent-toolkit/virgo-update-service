var upgradeApp = angular.module('upgradeApp', ['ngRoute', 'upgradeAppControllers']);

upgradeApp.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/test', {
    templateUrl: 'views/main.html',
    controller: 'MainController'
  }).otherwise({
    redirectTo: '/test'
  });
}]);
