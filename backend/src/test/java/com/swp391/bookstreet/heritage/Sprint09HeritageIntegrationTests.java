package com.swp391.bookstreet.heritage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
class Sprint09HeritageIntegrationTests {
    private static final String SCHEMA =
            "s9_api_" + UUID.randomUUID().toString().replace("-", "");
    private static final String PUBLIC = "/api/v1/heritages";
    private static final String ORGANIZER = "/api/v1/organizer/heritages";

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", Sprint09HeritageIntegrationTests::databaseUrl);
        registry.add("spring.datasource.username", Sprint09HeritageIntegrationTests::databaseUser);
        registry.add("spring.datasource.password", Sprint09HeritageIntegrationTests::databasePassword);
        registry.add("spring.flyway.default-schema", () -> SCHEMA);
        registry.add("spring.flyway.schemas", () -> SCHEMA);
        registry.add("spring.flyway.create-schemas", () -> true);
        registry.add("spring.jpa.properties.hibernate.default_schema", () -> SCHEMA);
    }

    @BeforeEach
    void clearHeritage() {
        jdbc.update("delete from " + table("heritage_contents"));
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
    void anonymousPublicReadsExposeOnlyPublishedRowsInDeterministicOrder() throws Exception {
        Instant firstPublication = Instant.parse("2026-11-01T07:00:00Z");
        long first = insert("DS-FIRST", "Di sản thứ nhất", "PUBLISHED", firstPublication);
        long second = insert("DS-SECOND", "Di sản thứ hai", "PUBLISHED", firstPublication);
        insert("DS-DRAFT", "Di sản nháp", "DRAFT", null);
        insert("DS-ARCHIVED", "Di sản lưu trữ", "ARCHIVED", firstPublication);

        mvc.perform(get(PUBLIC))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].publicCode").value("DS-SECOND"))
                .andExpect(jsonPath("$.content[1].publicCode").value("DS-FIRST"))
                .andExpect(jsonPath("$.content[0].heritageContentId").doesNotExist())
                .andExpect(jsonPath("$.content[0].updatedAt").doesNotExist());
        assertThat(second).isGreaterThan(first);

        mvc.perform(get(PUBLIC + "/DS-FIRST"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("Nội dung di sản đủ dài để phục vụ kiểm thử."));
        for (String code : new String[]{"DS-DRAFT", "DS-ARCHIVED", "ds-first", "UNKNOWN"}) {
            mvc.perform(get(PUBLIC + "/" + code))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("HERITAGE_NOT_FOUND"));
        }
        mvc.perform(get(PUBLIC).queryParam("search", "Di sản"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILTER"));
    }

    @Test
    void organizerBoundaryRequiresOrganizerAndCsrf() throws Exception {
        mvc.perform(get(ORGANIZER))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("Cache-Control", "no-store"));
        mvc.perform(get(ORGANIZER).with(user("admin").roles("ADMIN")))
                .andExpect(status().isForbidden())
                .andExpect(header().string("Cache-Control", "no-store"));
        mvc.perform(post(ORGANIZER)
                        .with(user("organizer").roles("ORGANIZER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validCreate("secure-code")))
                .andExpect(status().isForbidden())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
    }

    @Test
    void createNormalizesDataGeneratesUniqueCodesAndRejectsCallerSuppliedCode() throws Exception {
        String createdBody = mvc.perform(post(ORGANIZER)
                        .with(user("organizer").roles("ORGANIZER"))
                        .with(csrf().asHeader())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validCreate("  Bưu   điện TP HCM  ")))
                .andExpect(status().isCreated())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.publicCode").value("BUU-DIEN-TP-HCM"))
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.publishedAt").doesNotExist())
                .andReturn().getResponse().getContentAsString();

        long heritageId = ((Number) JsonPath.read(createdBody, "$.heritageContentId")).longValue();
        assertThat(jdbc.queryForObject(
                "select public_code from " + table("heritage_contents")
                        + " where heritage_content_id = ?",
                String.class,
                heritageId
        )).isEqualTo("BUU-DIEN-TP-HCM");

        mvc.perform(post(ORGANIZER)
                        .with(user("organizer").roles("ORGANIZER"))
                        .with(csrf().asHeader())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validCreate("Bưu điện TP HCM")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.publicCode").value("BUU-DIEN-TP-HCM-2"));

        mvc.perform(post(ORGANIZER)
                        .with(user("organizer").roles("ORGANIZER"))
                        .with(csrf().asHeader())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validCreate("Nội dung khác").replace("}", ",\"publicCode\":\"TU-NHAP\"}")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UNKNOWN_FIELD"));
    }

    @Test
    void partialUpdateClearsOptionalFieldAdvancesTokenAndRejectsStaleWrite() throws Exception {
        String created = create("DS-UPDATE");
        long id = ((Number) JsonPath.read(created, "$.heritageContentId")).longValue();
        String token = JsonPath.read(created, "$.updatedAt");

        String updated = mvc.perform(patch(ORGANIZER + "/" + id)
                        .with(user("organizer").roles("ORGANIZER"))
                        .with(csrf().asHeader())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"summary":"   ","title":"  Tiêu   đề mới  ","expectedUpdatedAt":"%s"}
                                """.formatted(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Tiêu đề mới"))
                .andExpect(jsonPath("$.summary").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        String nextToken = JsonPath.read(updated, "$.updatedAt");
        assertThat(Instant.parse(nextToken)).isAfter(Instant.parse(token));

        mvc.perform(patch(ORGANIZER + "/" + id)
                        .with(user("organizer").roles("ORGANIZER"))
                        .with(csrf().asHeader())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Không được ghi đè","expectedUpdatedAt":"%s"}
                                """.formatted(token)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("HERITAGE_STALE_WRITE"));
        mvc.perform(patch(ORGANIZER + "/" + id)
                        .with(user("organizer").roles("ORGANIZER"))
                        .with(csrf().asHeader())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedUpdatedAt\":\"" + nextToken + "\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void lifecyclePreservesFirstPublicationAndControlsPublicVisibility() throws Exception {
        String created = create("DS-LIFECYCLE");
        long id = ((Number) JsonPath.read(created, "$.heritageContentId")).longValue();
        String token = JsonPath.read(created, "$.updatedAt");

        String published = transition(id, "publish", token, 200);
        String publishedAt = JsonPath.read(published, "$.publishedAt");
        String publishedToken = JsonPath.read(published, "$.updatedAt");
        mvc.perform(get(PUBLIC + "/DS-LIFECYCLE")).andExpect(status().isOk());

        String archived = transition(id, "archive", publishedToken, 200);
        assertThat((String) JsonPath.read(archived, "$.publishedAt")).isEqualTo(publishedAt);
        mvc.perform(get(PUBLIC + "/DS-LIFECYCLE")).andExpect(status().isNotFound());

        String archivedToken = JsonPath.read(archived, "$.updatedAt");
        String republished = transition(id, "republish", archivedToken, 200);
        assertThat((String) JsonPath.read(republished, "$.publishedAt")).isEqualTo(publishedAt);
        mvc.perform(get(PUBLIC + "/DS-LIFECYCLE")).andExpect(status().isOk());

        transition(id, "publish", JsonPath.read(republished, "$.updatedAt"), 409);
        transition(id, "archive", token, 409);
    }

    @Test
    void draftDeleteIsGuardedAndPublishedHistoryCannotBeDeleted() throws Exception {
        String draft = create("DS-DELETE");
        long draftId = ((Number) JsonPath.read(draft, "$.heritageContentId")).longValue();
        String draftToken = JsonPath.read(draft, "$.updatedAt");

        mvc.perform(delete(ORGANIZER + "/" + draftId)
                        .queryParam("expectedUpdatedAt", draftToken)
                        .with(user("organizer").roles("ORGANIZER"))
                        .with(csrf().asHeader()))
                .andExpect(status().isNoContent())
                .andExpect(header().string("Cache-Control", "no-store"));

        String publishedDraft = create("DS-NO-DELETE");
        long publishedId = ((Number) JsonPath.read(publishedDraft, "$.heritageContentId")).longValue();
        String published = transition(
                publishedId,
                "publish",
                JsonPath.read(publishedDraft, "$.updatedAt"),
                200
        );
        String publishedToken = JsonPath.read(published, "$.updatedAt");
        mvc.perform(delete(ORGANIZER + "/" + publishedId)
                        .queryParam("expectedUpdatedAt", publishedToken)
                        .with(user("organizer").roles("ORGANIZER"))
                        .with(csrf().asHeader()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("HERITAGE_DELETE_CONFLICT"));
        assertThat(jdbc.queryForObject(
                "select count(*) from " + table("heritage_contents")
                        + " where heritage_content_id = ?",
                Integer.class,
                publishedId
        )).isOne();
    }

    @Test
    void organizerListSupportsServerFiltersAndRejectsInvalidQueries() throws Exception {
        insert("CODE-ALPHA", "Di sản Alpha", "DRAFT", null);
        insert("CODE-BETA", "Di sản Beta", "PUBLISHED", Instant.parse("2026-11-01T08:00:00Z"));

        mvc.perform(get(ORGANIZER)
                        .queryParam("search", "beta")
                        .queryParam("status", "PUBLISHED")
                        .queryParam("sort", "title,asc")
                        .with(user("organizer").roles("ORGANIZER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].publicCode").value("CODE-BETA"));
        mvc.perform(get(ORGANIZER)
                        .queryParam("status", "HIDDEN")
                        .with(user("organizer").roles("ORGANIZER")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_ENUM_VALUE"));
        mvc.perform(get(ORGANIZER)
                        .queryParam("ownerId", "1")
                        .with(user("organizer").roles("ORGANIZER")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILTER"));
    }

    @Test
    void concurrentOrganizersProduceOneGuardedUpdateWinner() throws Exception {
        String created = create("DS-RACE");
        long id = ((Number) JsonPath.read(created, "$.heritageContentId")).longValue();
        String token = JsonPath.read(created, "$.updatedAt");
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> updateStatus(id, token, "Tiêu đề Alpha", ready, start));
            var second = executor.submit(() -> updateStatus(id, token, "Tiêu đề Beta", ready, start));
            ready.await();
            start.countDown();
            assertThat(List.of(first.get(), second.get())).containsExactlyInAnyOrder(200, 409);
        }

        String storedTitle = jdbc.queryForObject(
                "select title from " + table("heritage_contents")
                        + " where heritage_content_id = ?",
                String.class,
                id
        );
        assertThat(storedTitle).isIn("Tiêu đề Alpha", "Tiêu đề Beta");
    }

    private String create(String expectedPublicCode) throws Exception {
        return mvc.perform(post(ORGANIZER)
                        .with(user("organizer").roles("ORGANIZER"))
                        .with(csrf().asHeader())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validCreate(expectedPublicCode.replace('-', ' '))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.publicCode").value(expectedPublicCode))
                .andReturn().getResponse().getContentAsString();
    }

    private String transition(long id, String action, String token, int expectedStatus) throws Exception {
        return mvc.perform(post(ORGANIZER + "/" + id + "/" + action)
                        .with(user("organizer").roles("ORGANIZER"))
                        .with(csrf().asHeader())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedUpdatedAt\":\"" + token + "\"}"))
                .andExpect(status().is(expectedStatus))
                .andReturn().getResponse().getContentAsString();
    }

    private int updateStatus(
            long id,
            String token,
            String title,
            CountDownLatch ready,
            CountDownLatch start
    ) throws Exception {
        ready.countDown();
        start.await();
        return mvc.perform(patch(ORGANIZER + "/" + id)
                        .with(user("organizer").roles("ORGANIZER"))
                        .with(csrf().asHeader())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"%s","expectedUpdatedAt":"%s"}
                                """.formatted(title, token)))
                .andReturn().getResponse().getStatus();
    }

    private String validCreate(String title) {
        return """
                {
                  "title":"%s",
                  "summary":"  Công trình kiến trúc tiêu biểu.  ",
                  "content":"  Nội dung di sản đủ dài để phục vụ kiểm thử.  ",
                  "imageUrl":"/assets/heritage/buu-dien.webp",
                  "locationText":"  Công xã Paris  "
                }
                """.formatted(title);
    }

    private long insert(String code, String title, String status, Instant publishedAt) {
        Instant createdAt = Instant.parse("2026-11-01T06:00:00Z");
        Instant updatedAt = publishedAt == null ? createdAt : publishedAt;
        return jdbc.queryForObject("""
                insert into %s(
                    public_code, title, content, status, published_at, created_at, updated_at
                ) values (?, ?, 'Nội dung di sản đủ dài để phục vụ kiểm thử.', ?, ?, ?, ?)
                returning heritage_content_id
                """.formatted(table("heritage_contents")), Long.class,
                code,
                title,
                status,
                publishedAt == null ? null : Timestamp.from(publishedAt),
                Timestamp.from(createdAt),
                Timestamp.from(updatedAt));
    }

    private static String table(String name) {
        return quotedSchema() + ".\"" + name + "\"";
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
