package com.swp391.bookstreet.admin.controller;

import com.swp391.bookstreet.common.response.ApiErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Admin account operations must not answer a server error for unreadable input (section 13 of the contract). */
@RestControllerAdvice(assignableTypes = AdminUserController.class)
public class AdminUserApiExceptionHandler {

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiErrorResponse> handleUnreadable(HttpMessageNotReadableException error,
            HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_CONTENT).body(new ApiErrorResponse(
                "VALIDATION_FAILED", "Request body is missing or malformed.", List.of(),
                Instant.now(), request.getRequestURI()));
    }
}
