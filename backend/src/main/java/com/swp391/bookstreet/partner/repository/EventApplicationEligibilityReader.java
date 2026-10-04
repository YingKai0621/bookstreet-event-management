package com.swp391.bookstreet.partner.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Optional;

/** Read-only Event projection used by the Partner module to check UC-E01 eligibility. */
@Repository
public class EventApplicationEligibilityReader {

    private static final String FIND_ELIGIBILITY_SQL = """
            SELECT status, partner_application_deadline_at
            FROM events
            WHERE event_id = ?
            """;

    private final JdbcTemplate jdbcTemplate;

    public EventApplicationEligibilityReader(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<EventApplicationEligibility> findByEventId(Long eventId) {
        return jdbcTemplate.query(
                FIND_ELIGIBILITY_SQL,
                (resultSet, rowNumber) -> new EventApplicationEligibility(
                        resultSet.getString("status"),
                        resultSet.getObject("partner_application_deadline_at", OffsetDateTime.class)
                ),
                eventId
        ).stream().findFirst();
    }

    public record EventApplicationEligibility(String status, OffsetDateTime deadlineAt) {
    }
}
