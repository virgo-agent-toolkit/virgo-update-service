var upgradeApp = angular.module('upgradeApp', ['ngRoute', 'upgradeAppServices', 'upgradeAppControllers']);

upgradeApp.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/', {
    templateUrl: 'views/main.html',
    controller: 'MainController'
  }).otherwise({
    redirectTo: '/'
  });
}]);
