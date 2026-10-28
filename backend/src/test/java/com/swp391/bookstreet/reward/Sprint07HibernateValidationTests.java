package com.swp391.bookstreet.reward;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
class Sprint07HibernateValidationTests {
    private static final String SCHEMA =
            "s7_hibernate_" + UUID.randomUUID().toString().replace("-", "");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", Sprint07HibernateValidationTests::databaseUrl);
        registry.add("spring.datasource.username", Sprint07HibernateValidationTests::databaseUser);
        registry.add("spring.datasource.password", Sprint07HibernateValidationTests::databasePassword);
        registry.add("spring.flyway.default-schema", () -> SCHEMA);
        registry.add("spring.flyway.schemas", () -> SCHEMA);
        registry.add("spring.flyway.create-schemas", () -> true);
        registry.add("spring.jpa.properties.hibernate.default_schema", () -> SCHEMA);
    }

    @AfterAll
    static void dropSchema() throws SQLException {
        try (Connection connection = DriverManager.getConnection(
                databaseUrl(), databaseUser(), databasePassword());
                Statement statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA IF EXISTS " + quotedSchema() + " CASCADE");
        }
    }

    @Test
    void contextLoadsWithHibernateValidateAgainstV12() {
    }

    private static String quotedSchema() {
        return '"' + SCHEMA.replace("\"", "\"\"") + '"';
    }

    private static String databaseUrl() {
        return System.getenv("EVENT_TEST_DATABASE_URL");
    }

    private static String databaseUser() {
        return System.getenv().getOrDefault("EVENT_TEST_DATABASE_USER", "postgres");
    }

    private static String databasePassword() {
        return System.getenv().getOrDefault("EVENT_TEST_DATABASE_PASSWORD", "postgres");
    }
}
