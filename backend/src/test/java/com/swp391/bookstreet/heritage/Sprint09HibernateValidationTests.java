package com.swp391.bookstreet.heritage;

import static org.assertj.core.api.Assertions.assertThat;

import com.swp391.bookstreet.heritage.entity.HeritageContent;
import com.swp391.bookstreet.heritage.entity.HeritageContentStatus;
import com.swp391.bookstreet.heritage.repository.HeritageContentRepository;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
class Sprint09HibernateValidationTests {
    private static final String SCHEMA =
            "s9_hibernate_" + UUID.randomUUID().toString().replace("-", "");

    @Autowired HeritageContentRepository repository;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", Sprint09HibernateValidationTests::databaseUrl);
        registry.add("spring.datasource.username", Sprint09HibernateValidationTests::databaseUser);
        registry.add("spring.datasource.password", Sprint09HibernateValidationTests::databasePassword);
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
    void contextLoadsWithHibernateValidateAgainstV15() {
    }

    @Test
    @Transactional
    void repositoryPersistsCanonicalDraftAndQueriesPublishedContent() {
        Instant createdAt = Instant.parse("2026-11-01T07:00:00Z");
        HeritageContent draft = repository.saveAndFlush(HeritageContent.createDraft(
                "DS-FOUNDATION",
                "Di sản nền tảng",
                null,
                "Nội dung di sản nền tảng đủ dài để kiểm thử.",
                null,
                null,
                createdAt
        ));

        assertThat(draft.getHeritageContentId()).isNotNull();
        assertThat(draft.getStatus()).isEqualTo(HeritageContentStatus.DRAFT);
        assertThat(draft.getPublishedAt()).isNull();
        assertThat(repository.existsByPublicCode("DS-FOUNDATION")).isTrue();
        assertThat(repository.findByPublicCodeAndStatus(
                "DS-FOUNDATION", HeritageContentStatus.PUBLISHED)).isEmpty();

        draft.publish(createdAt.plusSeconds(1));
        repository.saveAndFlush(draft);

        assertThat(repository.findByPublicCodeAndStatus(
                "DS-FOUNDATION", HeritageContentStatus.PUBLISHED))
                .contains(draft);
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
