package com.swp391.bookstreet.activity.exception;

import org.springframework.http.HttpStatus;

public class ActivityApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final String field;

    public ActivityApiException(HttpStatus status, String code, String message) {
        this(status, code, message, null);
    }

    public ActivityApiException(HttpStatus status, String code, String message, String field) {
        super(message);
        this.status = status;
        this.code = code;
        this.field = field;
    }

    public HttpStatus getStatus() { return status; }
    public String getCode() { return code; }
    public String getField() { return field; }
}
