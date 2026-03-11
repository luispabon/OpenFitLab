FROM alpine:3.21
RUN apk add --no-cache restic mysql-client bash
COPY entrypoint.sh /entrypoint.sh
COPY backup.sh /backup.sh
COPY restore.sh /restore.sh
RUN chmod +x /entrypoint.sh /backup.sh /restore.sh
ENTRYPOINT ["/entrypoint.sh"]
