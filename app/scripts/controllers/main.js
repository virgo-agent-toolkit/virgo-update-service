var upgradeApp = angular.module('upgradeApp');

upgradeApp.controller('MainController', function($scope, UpgradeService, $location) {
  $scope.deployData = {};

  $scope.isUnchanged = function(data) {
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
    if (data.success) {
      $scope.servers = data.values;
    };
  });

  $scope.deploy = function() {
    UpgradeService.deploy($scope.deployData)
      .success(function() {
        $location.path('/deploy');
      });
  };
});
