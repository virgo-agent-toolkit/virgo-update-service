FROM rphillips/docker-base-image

ADD https://github.com/isaacs/nave/raw/v0.4.5/nave.sh /usr/local/bin/nave
RUN chmod 755 /usr/local/bin/nave

RUN nave install stable && \
    nave use stable npm install -g bower && \
    nave use stable npm install -g virgo-update-service

ENTRYPOINT ["/usr/local/bin/nave", "use", "stable", "virgo-update-service"]
