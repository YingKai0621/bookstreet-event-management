package com.swp391.bookstreet.event.exception;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

// Scoped to Event so this feature does not change other modules' error handling.
@RestControllerAdvice(basePackages = "com.swp391.bookstreet.event.controller")
public class EventExceptionHandler {
    @ExceptionHandler(EventException.class)
    ResponseEntity<EventErrorResponse> handleEvent(EventException error, HttpServletRequest request) {
        var fields = error.getField() == null ? List.<EventErrorResponse.FieldError>of()
                : List.of(new EventErrorResponse.FieldError(error.getField(), error.getMessage()));
        return ResponseEntity.status(error.getStatus()).body(new EventErrorResponse(
                error.getCode(), error.getMessage(), fields, Instant.now(), request.getRequestURI()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<EventErrorResponse> handleValidation(
            MethodArgumentNotValidException error, HttpServletRequest request) {
        var fields = error.getBindingResult().getFieldErrors().stream()
                .map(field -> new EventErrorResponse.FieldError(field.getField(), field.getDefaultMessage()))
                .toList();
        return ResponseEntity.unprocessableContent().body(new EventErrorResponse(
                "VALIDATION_FAILED", "Request validation failed.", fields,
                Instant.now(), request.getRequestURI()));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<EventErrorResponse> handleMalformed(Exception error, HttpServletRequest request) {
        return ResponseEntity.badRequest().body(new EventErrorResponse(
                "MALFORMED_REQUEST", "Invalid JSON, field type, or identifier.", List.of(),
                Instant.now(), request.getRequestURI()));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<EventErrorResponse> handleOversizedUpload(
            MaxUploadSizeExceededException error, HttpServletRequest request) {
        return ResponseEntity.unprocessableContent().body(new EventErrorResponse(
                "EVENT_BANNER_INVALID", "Ảnh banner không được vượt quá 5 MB.",
                List.of(new EventErrorResponse.FieldError(
                        "file", "Ảnh banner không được vượt quá 5 MB.")),
                Instant.now(), request.getRequestURI()));
    }
}

