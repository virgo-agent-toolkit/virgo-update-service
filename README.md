## virgo-update-service

[![Build Status](https://travis-ci.org/virgo-agent-toolkit/virgo-update-service.png?branch=master)](https://travis-ci.org/virgo-agent-toolkit/virgo-update-service)

NodeJS Service for Virgo Updates

The service shall provide the following features:

  * Mirror a PkgCloud Bucket locally to service GET requests for binaries and
    signatures
  * Provide a REST API for management
  * Provide a HTML interface for management
  * Use Etcd.
  * On upgrade, trigger a webhook with payload information of the upgrade
    1. Timestamp, channel and version number for traceability

## Screenshots

![](https://raw.github.com/virgo-agent-toolkit/virgo-update-service/e23675dbc7960b019e92c546579fb27dea4b714b/screenshots/screenshot1.png)
![](https://raw.github.com/virgo-agent-toolkit/virgo-update-service/e23675dbc7960b019e92c546579fb27dea4b714b/screenshots/screenshot2.png)

## API

#### Auth

POST /authenticate

JSON Request:


				{
					"username": "test_user",
					"password": "test_password"
				 }


Response: 200 OK


				{
					"token": "test_token"
				}


#### Versions

GET  /v1/versions/channel/:name

GET  /v1/versions/channel

GET  /v1/versions/remote

GET  /v1/versions/local

#### Channels

GET  /v1/channels

#### Nodes

GET  /v1/nodes

#### Deploy

POST /v1/deploy

Supply header to be `authorization : Bearer test_token` --> token received from the `/authenticate` call above.

JSON Request:


				{
					"version": "x.x.x",
					"channel": "test"
				}


Response: 200 OK


				{
					"success": true,
					"error": null
				}


GET  /v1/deploy/status

Supply header to be `authorization : Bearer test_token` --> token received from the `/authenticate` call above.
