package com.swp391.bookstreet.location.service;

import com.swp391.bookstreet.location.exception.LocationApiException;
import java.sql.SQLException;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LocationConstraintTranslatorTests {
    private final LocationConstraintTranslator translator = new LocationConstraintTranslator();

    @Test
    void translatesNormalizedCodeConstraint() {
        DataIntegrityViolationException error = violation("uk_locations_code_normalized");

        assertThatThrownBy(() -> translator.rethrow(error))
                .isInstanceOfSatisfying(LocationApiException.class, translated -> {
                    assertThat(translated.getCode()).isEqualTo("LOCATION_CODE_ALREADY_EXISTS");
                    assertThat(translated.getStatus().value()).isEqualTo(409);
                });
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
