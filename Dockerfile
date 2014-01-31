FROM ubuntu:precise
RUN apt-get update
RUN apt-get install -y python-software-properties build-essential
RUN add-apt-repository ppa:chris-lea/node.js
RUN echo "deb http://us.archive.ubuntu.com/ubuntu/ precise universe" >> /etc/apt/sources.list
RUN apt-get update
RUN apt-get install -y nodejs git-core
ADD . /var/service
EXPOSE 34000
RUN (cd /var/service && make deps)
ENTRYPOINT ['node', '/var/service/server/bin/virgo-update-service', '-c', '/var/service/server/local_settings.js-vagrant']
