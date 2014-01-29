var upgradeApp = angular.module('upgradeApp', ['ngRoute', 'upgradeAppServices', 'upgradeAppControllers']);

upgradeApp.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/', {
    templateUrl: 'views/main.html',
    controller: 'MainController'
  })
  .when('/deploy', {
    templateUrl: 'views/deploy.html',
    controller: 'MainController'
  })
  .otherwise({
    redirectTo: '/'
  });
}]);
