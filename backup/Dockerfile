FROM alpine:3.21
ARG SUPERCRONIC_VERSION=0.2.33

RUN apk add --no-cache restic mysql-client bash wget \
    && ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/') \
    && wget -qO /usr/local/bin/supercronic \
         "https://github.com/aptible/supercronic/releases/download/v${SUPERCRONIC_VERSION}/supercronic-linux-${ARCH}" \
    && chmod +x /usr/local/bin/supercronic

ENV RESTIC_CACHE_DIR=/var/cache/restic

RUN adduser -D -H -s /sbin/nologin backup

COPY entrypoint.sh /entrypoint.sh
COPY backup.sh /backup.sh
COPY restore.sh /restore.sh
COPY crontab /crontab

RUN chmod +x /entrypoint.sh /backup.sh /restore.sh \
    && mkdir -p /restores /var/cache/restic \
    && touch /var/log/backup.log \
    && chown backup:backup /restores /var/cache/restic /var/log/backup.log

USER backup
ENTRYPOINT ["/entrypoint.sh"]
