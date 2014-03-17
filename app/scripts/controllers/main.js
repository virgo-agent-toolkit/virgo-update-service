var upgradeApp = angular.module('upgradeApp');

upgradeApp.controller('MainController', function($scope, UpgradeService, $timeout, $location) {
  var mytimeout;

  $scope.isDeployInProgress = false;
  $scope.deployData = {};
  $scope.deploy = {};

  $scope.getStats = function(callback) {
    UpgradeService.getDeployStatus().success(function(stats) {
      $scope.deploy.current_downloads = stats.values.current_downloads;
      $scope.isDeployInProgress = $scope.deploy.current_downloads.length > 0;
      if (callback) { callback(); }
    });
  }

  $scope.statsTimer = function() {
    $scope.getStats(function() {
      mytimeout = $timeout($scope.statsTimer, 5000);
    });
  };

  $scope.$on('$destroy', function() {
    $timeout.cancel(mytimeout);
  });

  $scope.statsTimer();

  $scope.isUnchanged = function(data) {
    if ($scope.isDeployInProgress === true) {
      return true;
    }
    if (data.newChannelName) {
      if (data.channel) {
        return true;
      }
      return false;
    }
    return data.version === undefined || data.channel === undefined;
  };

  UpgradeService.getAvailableRemoteVersions().success(function(versions) {
    $scope.remote_versions = versions.values;
  });

  UpgradeService.getAvailableLocalVersions().success(function(versions) {
    $scope.local_versions = versions.values;
  });

  UpgradeService.getAvailableChannelVersions().success(function(versions) {
    $scope.channel_versions = versions.values;
  });

  UpgradeService.getAvailableChannels().success(function(channels) {
    $scope.channels = channels.values;
  });

  UpgradeService.getServiceNodes().success(function(data) {
    $scope.servers = data.values;
  });

  $scope.deploy = function() {
    UpgradeService.deploy($scope.deployData);
  };
});
