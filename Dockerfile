FROM ubuntu:precise
RUN apt-get update
RUN apt-get install -y python-software-properties
RUN add-apt-repository ppa:chris-lea/node.js
RUN echo "deb http://us.archive.ubuntu.com/ubuntu/ precise universe" >> /etc/apt/sources.list
RUN apt-get update
RUN apt-get install -y nodejs git-core
RUN git clone https://github.com/virgo-agent-toolkit/virgo-update-service.git /var/service
EXPOSE 34000
RUN (cd /var/service && npm install)
CMD node /var/service/server/bin/virgo-update-service -c /var/service/server/local_settings.js-vagrant
