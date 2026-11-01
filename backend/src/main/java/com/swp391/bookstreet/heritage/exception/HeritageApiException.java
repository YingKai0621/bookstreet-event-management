package com.swp391.bookstreet.heritage.exception;

import com.swp391.bookstreet.common.response.FieldValidationError;
import java.util.List;
import org.springframework.http.HttpStatus;

public class HeritageApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final List<FieldValidationError> fieldErrors;

    public HeritageApiException(HttpStatus status, String code, String message) {
        this(status, code, message, List.of());
    }

    public HeritageApiException(
            HttpStatus status,
            String code,
            String message,
            List<FieldValidationError> fieldErrors
    ) {
        super(message);
        this.status = status;
        this.code = code;
        this.fieldErrors = List.copyOf(fieldErrors);
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public List<FieldValidationError> getFieldErrors() {
        return fieldErrors;
    }
}
