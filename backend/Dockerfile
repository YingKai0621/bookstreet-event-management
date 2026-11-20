FROM maven:3.9.11-eclipse-temurin-21 AS build

WORKDIR /workspace

COPY pom.xml ./
RUN mvn --batch-mode --no-transfer-progress -DskipTests dependency:go-offline

COPY src ./src
RUN mvn --batch-mode --no-transfer-progress -DskipTests package

FROM eclipse-temurin:21-jre

RUN useradd --system --create-home --uid 10001 bookstreet

WORKDIR /app

COPY --from=build /workspace/target/bookstreet-backend-*.jar /app/app.jar
COPY docker-entrypoint.sh /app/docker-entrypoint.sh

RUN chmod 0555 /app/docker-entrypoint.sh \
    && chown -R bookstreet:bookstreet /app

USER bookstreet

EXPOSE 10000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
