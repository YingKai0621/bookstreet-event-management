package com.swp391.bookstreet.activity.exception;

import com.swp391.bookstreet.common.response.ApiErrorResponse;
import com.swp391.bookstreet.common.response.FieldValidationError;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(basePackages = "com.swp391.bookstreet.activity.controller")
public class ActivityApiExceptionHandler {
    @ExceptionHandler(ActivityApiException.class)
    ResponseEntity<ApiErrorResponse> handleActivity(ActivityApiException error,
            HttpServletRequest request) {
        List<FieldValidationError> fields = error.getField() == null ? List.of()
                : List.of(new FieldValidationError(error.getField(), error.getMessage()));
        return ResponseEntity.status(error.getStatus()).body(new ApiErrorResponse(
                error.getCode(), error.getMessage(), fields, Instant.now(), request.getRequestURI()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiErrorResponse> handleUnreadable(HttpMessageNotReadableException error,
            HttpServletRequest request) {
        Throwable cause = error;
        while (cause != null) {
            if (cause.getMessage() != null
                    && cause.getMessage().contains("Unknown Activity field:")) {
                return ResponseEntity.badRequest().body(new ApiErrorResponse(
                        "UNKNOWN_FIELD", "Request contains an unsupported field.", List.of(),
                        Instant.now(), request.getRequestURI()));
            }
            cause = cause.getCause();
        }
        return malformed(request);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ApiErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException error,
            HttpServletRequest request) {
        return malformed(request);
    }

    private static ResponseEntity<ApiErrorResponse> malformed(HttpServletRequest request) {
        return ResponseEntity.badRequest().body(new ApiErrorResponse(
                "MALFORMED_REQUEST", "Invalid JSON, field type, or identifier.", List.of(),
                Instant.now(), request.getRequestURI()));
    }
}
