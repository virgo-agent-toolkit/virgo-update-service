## virgo-update-service

[![Build Status](https://travis-ci.org/virgo-agent-toolkit/virgo-update-service.png?branch=master)](https://travis-ci.org/virgo-agent-toolkit/virgo-update-service)

NodeJS Service for Virgo Updates

The service shall provide the following features:

  * Mirror a PkgCloud Bucket locally to service GET requests for binaries and
    signatures
  * Provide a REST API for management
  * Provide a HTML interface for management
  * Use RAFT to provide consensus management. The goal is to allow a datacenter
    to provide 'N' instances of the update service:
      1. send an upgrade REST call with a version to one service
      2. wait for all instances to download the PkgCloud bucket
      3. report back to the group that an upgrade to version X.Y.Z is allowed
      4. profit
  * On upgrade, trigger a webhook with payload information of the upgrade
    1. Timestamp, channel and version number for traceability

## Screenshots

![](https://raw.github.com/virgo-agent-toolkit/virgo-update-service/e23675dbc7960b019e92c546579fb27dea4b714b/screenshots/screenshot1.png)
![](https://raw.github.com/virgo-agent-toolkit/virgo-update-service/e23675dbc7960b019e92c546579fb27dea4b714b/screenshots/screenshot2.png)
