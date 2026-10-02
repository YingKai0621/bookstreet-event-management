package com.swp391.bookstreet.common.exception;

import com.swp391.bookstreet.common.response.ApiErrorResponse;
import com.swp391.bookstreet.common.response.FieldValidationError;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiErrorResponse> handleApiException(
            ApiException exception,
            HttpServletRequest request
    ) {
        ApiErrorResponse response = new ApiErrorResponse(
                exception.getCode(),
                exception.getMessage(),
                List.of(),
                Instant.now(),
                request.getRequestURI()
        );

        return ResponseEntity.status(exception.getStatus()).body(response);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiErrorResponse> handleValidationException(
            MethodArgumentNotValidException exception,
            HttpServletRequest request
    ) {
        List<FieldValidationError> fieldErrors = new ArrayList<>();

        for (FieldError error : exception.getBindingResult().getFieldErrors()) {
            FieldValidationError fieldValidationError = new FieldValidationError(
                    error.getField(),
                    error.getDefaultMessage()
            );
            fieldErrors.add(fieldValidationError);
        }

        ApiErrorResponse response = new ApiErrorResponse(
                "VALIDATION_FAILED",
                "Request validation failed.",
                fieldErrors,
                Instant.now(),
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_CONTENT).body(response);
    }
}
