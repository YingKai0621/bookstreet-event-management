package com.swp391.bookstreet.reward.exception;

import com.swp391.bookstreet.common.response.ApiErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(basePackages = "com.swp391.bookstreet.reward.controller")
public class RewardApiExceptionHandler {
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ApiErrorResponse> handleTypeMismatch(
            MethodArgumentTypeMismatchException error, HttpServletRequest request) {
        String code = switch (error.getName()) {
            case "page" -> "INVALID_PAGE";
            case "size" -> "INVALID_SIZE";
            case "eventId", "boothId" -> "INVALID_FILTER";
            default -> "MALFORMED_REQUEST";
        };
        return ResponseEntity.badRequest().body(new ApiErrorResponse(
                code, "Invalid reward query parameter.", List.of(),
                Instant.now(), request.getRequestURI()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiErrorResponse> handleUnreadable(
            HttpMessageNotReadableException error, HttpServletRequest request) {
        Throwable cause = error;
        while (cause != null) {
            if (cause.getMessage() != null
                    && cause.getMessage().contains("Unknown Booth scan field.")) {
                return ResponseEntity.badRequest().body(new ApiErrorResponse(
                        "UNKNOWN_FIELD", "Request contains an unsupported field.", List.of(),
                        Instant.now(), request.getRequestURI()));
            }
            cause = cause.getCause();
        }
        return ResponseEntity.badRequest().body(new ApiErrorResponse(
                "MALFORMED_REQUEST", "Invalid JSON or request body.", List.of(),
                Instant.now(), request.getRequestURI()));
    }
}
