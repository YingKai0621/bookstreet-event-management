package com.swp391.bookstreet.booth.exception;

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
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice(basePackages = {
        "com.swp391.bookstreet.booth.controller",
        "com.swp391.bookstreet.payment.controller"
})
public class BoothApiExceptionHandler {
    @ExceptionHandler(BoothApiException.class)
    ResponseEntity<ApiErrorResponse> handleBooth(BoothApiException error,
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

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<ApiErrorResponse> handleMalformed(Exception error, HttpServletRequest request) {
        return ResponseEntity.badRequest().body(new ApiErrorResponse(
                "MALFORMED_REQUEST", "Invalid JSON, field type, or identifier.", List.of(),
                Instant.now(), request.getRequestURI()));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ApiErrorResponse> handleOversizedUpload(
            MaxUploadSizeExceededException error, HttpServletRequest request) {
        String message = "Ảnh gian hàng không được vượt quá 5 MB.";
        return ResponseEntity.unprocessableContent().body(new ApiErrorResponse(
                "BOOTH_IMAGE_INVALID", message,
                List.of(new FieldValidationError("file", message)),
                Instant.now(), request.getRequestURI()));
    }
}
