package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.exception.ActivityApiException;
import java.sql.SQLException;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ActivityConstraintTranslatorTests {
    private final ActivityConstraintTranslator translator = new ActivityConstraintTranslator();

    @Test
    void translatesLocationTimeExclusionConstraint() {
        DataIntegrityViolationException error = violation("ex_activities_location_time");

        assertThatThrownBy(() -> translator.rethrow(error))
                .isInstanceOfSatisfying(ActivityApiException.class, translated -> {
                    org.assertj.core.api.Assertions.assertThat(translated.getCode())
                            .isEqualTo("ACTIVITY_LOCATION_TIME_CONFLICT");
                    org.assertj.core.api.Assertions.assertThat(translated.getStatus().value())
                            .isEqualTo(409);
                });
    }

    @Test
    void translatesSinglePendingRequestConstraint() {
        DataIntegrityViolationException error = violation("uk_activity_requests_one_pending");

        assertThatThrownBy(() -> translator.rethrow(error))
                .isInstanceOfSatisfying(ActivityApiException.class, translated ->
                        org.assertj.core.api.Assertions.assertThat(translated.getCode())
                                .isEqualTo("ACTIVITY_REQUEST_ALREADY_PENDING"));
    }

    @Test
    void preservesUnknownIntegrityViolation() {
        DataIntegrityViolationException error = violation("some_future_constraint");

        assertThatThrownBy(() -> translator.rethrow(error)).isSameAs(error);
    }

    private static DataIntegrityViolationException violation(String constraintName) {
        var cause = new ConstraintViolationException("constraint failed", new SQLException(),
                constraintName);
        return new DataIntegrityViolationException("write failed", cause);
    }
}
