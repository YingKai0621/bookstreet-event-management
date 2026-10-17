package com.swp391.bookstreet.location.service;

import com.swp391.bookstreet.location.exception.LocationApiException;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class LocationConstraintTranslator {
    private static final String CODE_CONSTRAINT = "uk_locations_code_normalized";

    public void rethrow(DataIntegrityViolationException error) {
        if (CODE_CONSTRAINT.equals(constraintName(error))) {
            throw new LocationApiException(HttpStatus.CONFLICT,
                    "LOCATION_CODE_ALREADY_EXISTS",
                    "A Location with this code already exists.");
        }
        throw error;
    }

    static String constraintName(Throwable error) {
        Throwable current = error;
        while (current != null) {
            if (current instanceof ConstraintViolationException violation) {
                return violation.getConstraintName();
            }
            current = current.getCause();
        }
        return null;
    }
}
