package com.swp391.bookstreet.partner.service;

import org.springframework.http.HttpStatus;

public class PartnerApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public PartnerApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }
}
