var module = angular.module('upgradeAppWebSocket', ['btford.socket-io']);

module.factory('WebSocket', function(socketFactory, $window) {
  return socketFactory({
    ioSocket: io.connect('', {
      query: 'token=' + $window.sessionStorage.token
    })
  });
});
