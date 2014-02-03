var upgradeApp = angular.module('upgradeApp', [
  'btford.socket-io',
  'ngRoute',
  'upgradeAppWebSocket',
  'upgradeAppServices'
]);

upgradeApp.run(function($location, $window, $rootScope) {
  $rootScope.$on("$routeChangeStart", function(event, next, current) {
    $rootScope.isLoggedIn = $window.sessionStorage.getItem("token") !== null;
    if (!$rootScope.isLoggedIn) {
      $location.path('/login');
    }
  });
  $rootScope.logout = function() {
    delete $window.sessionStorage.token;
    $location.path('/login');
  };
});

upgradeApp.factory('authInterceptor', function($rootScope, $q, $window, $location) {
  return {
    request: function (config) {
      config.headers = config.headers || {};
      if ($window.sessionStorage.token) {
        config.headers.Authorization = 'Bearer ' + $window.sessionStorage.token;
      }
      return config;
    },
    response: function (response) {
      if (response.status === 401) {
        // handle the case where the user is not authenticated
      }
      return response || $q.when(response);
    }
  };
});

upgradeApp.config(function($routeProvider, $httpProvider) {
  $httpProvider.interceptors.push('authInterceptor');

  $routeProvider
    .when('/main', {
      templateUrl: 'views/main.html',
      controller: 'MainController'
    })
    .when('/login', {
      templateUrl: 'views/login.html',
      controller: 'LoginController'
    })
    .when('/deploy', {
      templateUrl: 'views/deploy.html',
      controller: 'DeployController'
    })
    .otherwise('/main');
});
