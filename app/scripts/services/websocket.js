var module = angular.module('upgradeAppWebSocket', ['btford.socket-io']);
var service = function(socketFactory) {
  var socket = socketFactory();
  return socket;
};
module.factory('WebSocket', service);
