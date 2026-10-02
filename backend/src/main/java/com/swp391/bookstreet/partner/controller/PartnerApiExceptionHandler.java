package com.swp391.bookstreet.partner.controller;

import com.swp391.bookstreet.partner.dto.PartnerApiErrorResponse;
import com.swp391.bookstreet.partner.service.PartnerApiException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.ServletWebRequest;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestControllerAdvice(basePackages = "com.swp391.bookstreet.partner")
public class PartnerApiExceptionHandler {

    @ExceptionHandler(PartnerApiException.class)
    public ResponseEntity<PartnerApiErrorResponse> handlePartnerApiException(
            PartnerApiException exception,
            ServletWebRequest request
    ) {
        return ResponseEntity.status(exception.getStatus()).body(new PartnerApiErrorResponse(
                exception.getCode(),
                exception.getMessage(),
                List.of(),
                Instant.now(),
                request.getRequest().getRequestURI()
        ));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<PartnerApiErrorResponse> handleValidation(
            MethodArgumentNotValidException exception,
            ServletWebRequest request
    ) {
        List<Map<String, String>> fieldErrors = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(error -> Map.of(
                        "field", error.getField(),
                        "message", error.getDefaultMessage() == null
                                ? "Invalid value"
                                : error.getDefaultMessage()
                ))
                .toList();

        return ResponseEntity.unprocessableEntity().body(new PartnerApiErrorResponse(
                "VALIDATION_FAILED",
                "Request validation failed.",
                fieldErrors,
                Instant.now(),
                request.getRequest().getRequestURI()
        ));
    }
}
