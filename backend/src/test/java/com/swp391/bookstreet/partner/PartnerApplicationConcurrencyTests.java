package com.swp391.bookstreet.partner;

import com.swp391.bookstreet.partner.dto.ReviewPartnerApplicationRequest;
import com.swp391.bookstreet.partner.dto.SubmitPartnerApplicationRequest;
import com.swp391.bookstreet.partner.service.OrganizerApplicationReviewService;
import com.swp391.bookstreet.partner.service.PartnerApiException;
import com.swp391.bookstreet.partner.service.PartnerApplicationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class PartnerApplicationConcurrencyTests {

    @Autowired JdbcTemplate jdbc;
    @Autowired PartnerApplicationService applications;
    @Autowired OrganizerApplicationReviewService reviews;

    private long partnerUserId;
    private long organizerUserId;
    private long organizationId;
    private long eventId;

    @BeforeEach
    void createCommittedFixture() {
        partnerUserId = user();
        organizerUserId = user();
        organizationId = jdbc.queryForObject("""
                INSERT INTO partner_organizations (representative_user_id, name, category_code,
                    status, created_at, updated_at)
                VALUES (?, 'Concurrency Publisher', 'PUBLISHER', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING partner_organization_id
                """, Long.class, partnerUserId);
        eventId = jdbc.queryForObject("""
                INSERT INTO events (organizer_user_id, name, start_at, end_at,
                    partner_application_deadline_at, booth_payment_window_minutes,
                    max_booths_per_partner, max_activities_per_partner, status, created_at, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP + INTERVAL '10 days',
                    CURRENT_TIMESTAMP + INTERVAL '11 days', CURRENT_TIMESTAMP + INTERVAL '5 days',
                    60, 2, 5, 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING event_id
                """, Long.class, organizerUserId, "Concurrent Test " + UUID.randomUUID());
    }

    @AfterEach
    void removeCommittedFixture() {
        jdbc.update("""
                DELETE FROM notifications
                WHERE partner_event_application_id IN (
                    SELECT application_id FROM partner_event_applications WHERE event_id = ?
                )
                OR recipient_user_id IN (?, ?)
                """, eventId, partnerUserId, organizerUserId);
        jdbc.update("DELETE FROM partner_event_applications WHERE event_id = ?", eventId);
        jdbc.update("DELETE FROM partner_organizations WHERE partner_organization_id = ?", organizationId);
        jdbc.update("DELETE FROM events WHERE event_id = ?", eventId);
        jdbc.update("DELETE FROM users WHERE user_id IN (?, ?)", partnerUserId, organizerUserId);
    }

    @Test
    void concurrentSubmissionsCreateExactlyOneApplication() throws Exception {
        List<String> outcomes = race(() -> {
            try {
                applications.submit(partnerUserId, eventId,
                        new SubmitPartnerApplicationRequest("Concurrent submission"));
                return "CREATED";
            } catch (PartnerApiException exception) {
                return exception.getCode();
            }
        });

        assertThat(outcomes).containsExactlyInAnyOrder("CREATED", "APPLICATION_ALREADY_EXISTS");
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM partner_event_applications
                WHERE partner_organization_id = ? AND event_id = ?
                """, Long.class, organizationId, eventId)).isEqualTo(1);
    }

    @Test
    void concurrentReviewsAllowOnlyOneTransition() throws Exception {
        long applicationId = applications.submit(partnerUserId, eventId,
                new SubmitPartnerApplicationRequest("Review race")).applicationId();
        List<String> outcomes = race(() -> {
            try {
                return reviews.approve(applicationId, organizerUserId,
                        new ReviewPartnerApplicationRequest("Approved once")).status();
            } catch (PartnerApiException exception) {
                return exception.getCode();
            }
        });

        assertThat(outcomes).containsExactlyInAnyOrder("APPROVED", "APPLICATION_NOT_PENDING");
        assertThat(jdbc.queryForObject("""
                SELECT status FROM partner_event_applications WHERE application_id = ?
                """, String.class, applicationId)).isEqualTo("APPROVED");
    }

    private List<String> race(Callable<String> action) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            Callable<String> synchronizedAction = () -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) {
                    throw new IllegalStateException("Concurrent test did not start");
                }
                return action.call();
            };
            Future<String> first = executor.submit(synchronizedAction);
            Future<String> second = executor.submit(synchronizedAction);
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            return List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS));
        } finally {
            executor.shutdownNow();
        }
    }

    private long user() {
        String username = "cc" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        return jdbc.queryForObject("""
                INSERT INTO users (username, email, password_hash, full_name, status)
                VALUES (?, ?, 'unused-hash', 'Concurrency Test', 'ACTIVE') RETURNING user_id
                """, Long.class, username, username + "@example.test");
    }
}
