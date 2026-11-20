#!/bin/sh

set -eu

# Render provides a standard PostgreSQL connection string. Spring JDBC expects
# the same address with the jdbc:postgresql scheme, while credentials remain in
# their dedicated environment variables.
if [ -n "${DATABASE_URL:-}" ] && [ -z "${SPRING_DATASOURCE_URL:-}" ]; then
    database_address="${DATABASE_URL#*://}"
    database_address="${database_address#*@}"
    export SPRING_DATASOURCE_URL="jdbc:postgresql://${database_address}"
fi

exec java \
    -XX:MaxRAMPercentage=65.0 \
    -Djava.security.egd=file:/dev/urandom \
    -jar /app/app.jar
