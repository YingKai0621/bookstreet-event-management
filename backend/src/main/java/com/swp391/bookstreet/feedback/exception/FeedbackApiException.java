package com.swp391.bookstreet.feedback.exception;

import com.swp391.bookstreet.common.response.FieldValidationError;
import java.util.List;
import org.springframework.http.HttpStatus;

public class FeedbackApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final List<FieldValidationError> fieldErrors;
    private final Long retryAfterSeconds;

    public FeedbackApiException(HttpStatus status, String code, String message) {
        this(status, code, message, List.of(), null);
    }

    public FeedbackApiException(
            HttpStatus status,
            String code,
            String message,
            List<FieldValidationError> fieldErrors,
            Long retryAfterSeconds
    ) {
        super(message);
        this.status = status;
        this.code = code;
        this.fieldErrors = List.copyOf(fieldErrors);
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public HttpStatus getStatus() { return status; }
    public String getCode() { return code; }
    public List<FieldValidationError> getFieldErrors() { return fieldErrors; }
    public Long getRetryAfterSeconds() { return retryAfterSeconds; }
}
