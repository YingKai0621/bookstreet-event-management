package com.swp391.bookstreet.reward.exception;

import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.reward.controller.AdminBadgeController;
import com.swp391.bookstreet.reward.controller.OrganizerBoothVisitController;
import com.swp391.bookstreet.reward.exception.BadgeValidationException.Violation;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = {AdminBadgeController.class, OrganizerBoothVisitController.class})
public class RewardManagementExceptionHandler {
    private final Clock clock;
    public RewardManagementExceptionHandler(Clock clock) { this.clock = clock; }

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ErrorResponse> domain(ApiException error, HttpServletRequest request) {
        return response(error.getStatus().value(), error.getCode(), error.getMessage(), List.of(), request);
    }

    @ExceptionHandler(BadgeValidationException.class)
    ResponseEntity<ErrorResponse> validation(BadgeValidationException error, HttpServletRequest request) {
        return response(422, "VALIDATION_FAILED", error.getMessage(), error.getViolations(), request);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> beanValidation(MethodArgumentNotValidException error, HttpServletRequest request) {
        List<Violation> fields = error.getBindingResult().getFieldErrors().stream()
                .map(field -> new Violation(field.getField(), field.getDefaultMessage(),
                        "REQUIRED".equals(field.getDefaultMessage()) ? "Trường này là bắt buộc." : "Giá trị không hợp lệ."))
                .toList();
        return response(422, "VALIDATION_FAILED", "Dữ liệu huy hiệu không hợp lệ.", fields, request);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ErrorResponse> typeMismatch(MethodArgumentTypeMismatchException error, HttpServletRequest request) {
        String code = switch (error.getName()) {
            case "page" -> "INVALID_PAGE";
            case "size" -> "INVALID_SIZE";
            case "boothId", "active" -> "INVALID_FILTER";
            default -> "MALFORMED_REQUEST";
        };
        return response(400, code, "Tham số không hợp lệ.", List.of(), request);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ErrorResponse> unreadable(HttpMessageNotReadableException error, HttpServletRequest request) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause.getMessage() != null && cause.getMessage().contains("Unknown Badge field.")) {
                return response(400, "UNKNOWN_FIELD", "Yêu cầu chứa trường không được hỗ trợ.", List.of(), request);
            }
        }
        return response(400, "MALFORMED_REQUEST", "Nội dung yêu cầu không hợp lệ.", List.of(), request);
    }

    private ResponseEntity<ErrorResponse> response(int status, String code, String message,
            List<Violation> fields, HttpServletRequest request) {
        return ResponseEntity.status(status).body(new ErrorResponse(clock.instant(), status, code,
                message, fields, request.getRequestURI()));
    }

    public record ErrorResponse(Instant timestamp, int status, String code, String message,
            List<Violation> fieldErrors, String path) { }
}
