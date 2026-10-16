package com.swp391.bookstreet.location.exception;

import com.swp391.bookstreet.activity.exception.ActivityApiException;
import com.swp391.bookstreet.common.response.ApiErrorResponse;
import com.swp391.bookstreet.common.response.FieldValidationError;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(basePackages = "com.swp391.bookstreet.location.controller")
public class LocationApiExceptionHandler {
    @ExceptionHandler(ActivityApiException.class)
    ResponseEntity<ApiErrorResponse> handleIdentity(ActivityApiException error,
            HttpServletRequest request) {
        return ResponseEntity.status(error.getStatus()).body(new ApiErrorResponse(
                error.getCode(), error.getMessage(), List.of(), Instant.now(),
                request.getRequestURI()));
    }

    @ExceptionHandler(LocationApiException.class)
    ResponseEntity<ApiErrorResponse> handleLocation(LocationApiException error,
            HttpServletRequest request) {
        List<FieldValidationError> fields = error.getField() == null ? List.of()
                : List.of(new FieldValidationError(error.getField(), error.getMessage()));
        return ResponseEntity.status(error.getStatus()).body(new ApiErrorResponse(
                error.getCode(), error.getMessage(), fields, Instant.now(), request.getRequestURI()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException error,
            HttpServletRequest request) {
        List<FieldValidationError> fields = error.getBindingResult().getFieldErrors().stream()
                .map(field -> new FieldValidationError(field.getField(), field.getDefaultMessage()))
                .toList();
        return ResponseEntity.unprocessableContent().body(new ApiErrorResponse(
                "VALIDATION_FAILED", "Request validation failed.", fields,
                Instant.now(), request.getRequestURI()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiErrorResponse> handleUnreadable(HttpMessageNotReadableException error,
            HttpServletRequest request) {
        Throwable cause = error;
        while (cause != null) {
            if (cause.getMessage() != null
                    && cause.getMessage().contains("Unknown Location field:")) {
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
