package com.swp391.bookstreet.registration.exception;

import com.swp391.bookstreet.common.response.ApiErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(basePackages = "com.swp391.bookstreet.registration.controller")
public class RegistrationApiExceptionHandler {
    @ExceptionHandler(RegistrationApiException.class)
    ResponseEntity<ApiErrorResponse> handleRegistration(RegistrationApiException error,
            HttpServletRequest request) {
        return ResponseEntity.status(error.getStatus()).body(new ApiErrorResponse(
                error.getCode(), error.getMessage(), List.of(), Instant.now(),
                request.getRequestURI()));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ApiErrorResponse> handleTypeMismatch(
            MethodArgumentTypeMismatchException error, HttpServletRequest request) {
        return ResponseEntity.badRequest().body(new ApiErrorResponse(
                "MALFORMED_REQUEST", "Invalid field type or identifier.", List.of(),
                Instant.now(), request.getRequestURI()));
    }
}
