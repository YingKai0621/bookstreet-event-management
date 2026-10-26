package com.swp391.bookstreet.attendance.exception;

import com.swp391.bookstreet.activity.exception.ActivityApiException;
import com.swp391.bookstreet.registration.exception.RegistrationApiException;
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

@RestControllerAdvice(basePackages = "com.swp391.bookstreet.attendance.controller")
public class AttendanceApiExceptionHandler {
    @ExceptionHandler(ActivityApiException.class)
    public ResponseEntity<ApiErrorResponse> activity(ActivityApiException error, HttpServletRequest request) {
        List<FieldValidationError> fields = error.getField() == null ? List.of()
                : List.of(new FieldValidationError(error.getField(), error.getMessage()));
        return ResponseEntity.status(error.getStatus()).body(new ApiErrorResponse(error.getCode(),
                error.getMessage(), fields, Instant.now(), request.getRequestURI()));
    }

    @ExceptionHandler(RegistrationApiException.class)
    public ResponseEntity<ApiErrorResponse> registration(RegistrationApiException error, HttpServletRequest request) {
        return ResponseEntity.status(error.getStatus()).body(new ApiErrorResponse(error.getCode(),
                error.getMessage(), List.of(), Instant.now(), request.getRequestURI()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> json(HttpMessageNotReadableException error, HttpServletRequest request) {
        String code = "MALFORMED_REQUEST";
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause.getMessage() != null && cause.getMessage().contains("Unknown Attendance field.")) code = "UNKNOWN_FIELD";
            if (cause.getClass().getSimpleName().equals("UnrecognizedPropertyException")) code = "UNKNOWN_FIELD";
            if (cause.getClass().getSimpleName().equals("InvalidFormatException")
                    && cause.getMessage() != null && cause.getMessage().contains("AttendanceStatus")) code = "INVALID_ENUM_VALUE";
        }
        return badRequest(code, request);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiErrorResponse> mismatch(HttpServletRequest request) { return badRequest("MALFORMED_REQUEST", request); }

    private ResponseEntity<ApiErrorResponse> badRequest(String code, HttpServletRequest request) {
        return ResponseEntity.badRequest().body(new ApiErrorResponse(code, "Invalid request field or type.",
                List.of(), Instant.now(), request.getRequestURI()));
    }
}
