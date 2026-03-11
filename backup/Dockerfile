FROM alpine:3.21
RUN apk add --no-cache restic mysql-client bash

RUN adduser -D -H -s /sbin/nologin backup

COPY entrypoint.sh /entrypoint.sh
COPY backup.sh /backup.sh
COPY restore.sh /restore.sh
RUN chmod +x /entrypoint.sh /backup.sh /restore.sh \
    && mkdir -p /var/spool/cron/crontabs \
    && echo "0 * * * * /backup.sh >> /var/log/backup.log 2>&1" > /var/spool/cron/crontabs/backup \
    && chmod 600 /var/spool/cron/crontabs/backup \
    && chown backup:backup /var/spool/cron/crontabs/backup \
    && mkdir -p /restores \
    && touch /var/log/backup.log \
    && chown backup:backup /restores /var/log/backup.log

USER backup
ENTRYPOINT ["/entrypoint.sh"]
