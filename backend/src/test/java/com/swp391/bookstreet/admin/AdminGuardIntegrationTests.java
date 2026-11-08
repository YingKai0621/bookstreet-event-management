package com.swp391.bookstreet.admin;

import com.swp391.bookstreet.admin.service.AdminGuard;
import com.swp391.bookstreet.common.exception.ApiException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "logging.level.root=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = AdminGuardIntegrationTests.TestDatabaseGuard.class)
class AdminGuardIntegrationTests {
    static class TestDatabaseGuard
            implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext context) {
            String url = context.getEnvironment().getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException("Guard tests require a *_event_test database.");
            }
        }
    }

    @Autowired JdbcTemplate jdbc;
    @Autowired AdminGuard guard;
    @Autowired TransactionTemplate transactions;

    private final List<Long> created = new ArrayList<>();
    private List<Long> otherAdminsParked;

    @BeforeEach
    void parkOtherAdmins() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).endsWith("_event_test");
        // The guard counts every active Admin, so seeded ones are set aside for the test.
        otherAdminsParked = jdbc.queryForList("""
                select u.user_id from users u
                join user_roles ur on ur.user_id = u.user_id
                join roles r on r.role_id = ur.role_id
                where r.code = 'ADMIN' and u.status = 'ACTIVE' and u.email_verified_at is not null
                """, Long.class);
        otherAdminsParked.forEach(id -> jdbc.update("update users set status = 'DISABLED' where user_id = ?", id));
    }

    @AfterEach
    void cleanup() {
        created.forEach(id -> {
            jdbc.update("delete from user_roles where user_id = ?", id);
            jdbc.update("delete from users where user_id = ?", id);
        });
        otherAdminsParked.forEach(id -> jdbc.update("update users set status = 'ACTIVE' where user_id = ?", id));
    }

    @Test
    void theLastActiveAdminIsProtected() {
        long admin = insertAdmin(true, "ACTIVE");

        assertThatThrownBy(() -> check(admin))
                .isInstanceOfSatisfying(ApiException.class,
                        error -> assertThat(error.getCode()).isEqualTo("LAST_ACTIVE_ADMIN_REQUIRED"));
    }

    @Test
    void anotherActiveAdminAllowsTheChange() {
        long admin = insertAdmin(true, "ACTIVE");
        insertAdmin(true, "ACTIVE");

        assertThatCode(() -> check(admin)).doesNotThrowAnyException();
    }

    @Test
    void lockedOrUnverifiedAdminsDoNotCountAsActive() {
        long admin = insertAdmin(true, "ACTIVE");
        insertAdmin(true, "DISABLED");
        insertAdmin(false, "ACTIVE");

        assertThatThrownBy(() -> check(admin)).isInstanceOf(ApiException.class);
    }

    @Test
    void aTargetWhoIsNotAnActiveAdminPassesEvenWithOneAdminLeft() {
        insertAdmin(true, "ACTIVE");
        long disabled = insertAdmin(true, "DISABLED");

        assertThatCode(() -> check(disabled)).doesNotThrowAnyException();
    }

    @Test
    void theGuardRequiresTheCallersTransaction() {
        assertThatThrownBy(() -> guard.requireAnotherActiveAdmin(1L))
                .isInstanceOf(IllegalTransactionStateException.class);
    }

    @Test
    void concurrentLocksCannotRemoveEveryAdmin() throws Exception {
        long first = insertAdmin(true, "ACTIVE");
        long second = insertAdmin(true, "ACTIVE");
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<Boolean> lockFirst = executor.submit(() -> lock(first, ready, start));
            Future<Boolean> lockSecond = executor.submit(() -> lock(second, ready, start));
            ready.await();
            start.countDown();
            assertThat(List.of(lockFirst.get(), lockSecond.get())).containsExactlyInAnyOrder(true, false);
        }

        assertThat(jdbc.queryForObject("select count(*) from users where user_id in (?, ?) and status = 'ACTIVE'",
                Integer.class, first, second)).isOne();
    }

    private boolean lock(long target, CountDownLatch ready, CountDownLatch start) throws InterruptedException {
        ready.countDown();
        start.await();
        try {
            transactions.executeWithoutResult(status -> {
                guard.requireAnotherActiveAdmin(target);
                jdbc.update("update users set status = 'DISABLED' where user_id = ?", target);
            });
            return true;
        } catch (ApiException rejected) {
            return false;
        }
    }

    private void check(long target) {
        transactions.executeWithoutResult(status -> guard.requireAnotherActiveAdmin(target));
    }

    private long insertAdmin(boolean verified, String accountStatus) {
        String name = "guard" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        long id = jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, email, email_verified_at, status)
                values (?, '{noop}unused', 'Guard Test Admin', ?, case when ? then current_timestamp end, ?)
                returning user_id
                """, Long.class, name, name + "@example.test", verified, accountStatus);
        jdbc.update("insert into user_roles(user_id, role_id) select ?, role_id from roles where code = 'ADMIN'", id);
        created.add(id);
        return id;
    }
}
