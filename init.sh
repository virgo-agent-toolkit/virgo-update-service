#!/bin/sh

DEFAULT_VERSION='{"version":"1.0.0-7"}'
etcdctl mkdir /deploys
etcdctl mk /deploys/master "${DEFAULT_VERSION}"
etcdctl mk /deploys/stable "${DEFAULT_VERSION}"
etcdctl mk /deploys/unstable "${DEFAULT_VERSION}"
