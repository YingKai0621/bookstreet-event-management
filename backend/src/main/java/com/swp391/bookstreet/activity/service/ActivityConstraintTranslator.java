package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.exception.ActivityApiException;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class ActivityConstraintTranslator {
    public void rethrow(DataIntegrityViolationException error) {
        String constraint = constraintName(error);
        if ("ex_activities_location_time".equals(constraint)) {
            throw new ActivityApiException(HttpStatus.CONFLICT,
                    "ACTIVITY_LOCATION_TIME_CONFLICT",
                    "Location already has another Activity in this time interval.");
        }
        if ("uk_activity_requests_one_pending".equals(constraint)) {
            throw new ActivityApiException(HttpStatus.CONFLICT,
                    "ACTIVITY_REQUEST_ALREADY_PENDING",
                    "Activity already has a Pending change or cancellation request.");
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
