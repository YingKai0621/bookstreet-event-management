package com.swp391.bookstreet.feedback.exception;

import com.swp391.bookstreet.common.response.ApiErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(basePackages = "com.swp391.bookstreet.feedback.controller")
public class FeedbackApiExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(FeedbackApiExceptionHandler.class);

    @ExceptionHandler(FeedbackApiException.class)
    public ResponseEntity<ApiErrorResponse> feedback(
            FeedbackApiException exception,
            HttpServletRequest request
    ) {
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(exception.getStatus())
                .cacheControl(CacheControl.noStore());
        if (exception.getRetryAfterSeconds() != null) {
            builder.header(HttpHeaders.RETRY_AFTER, String.valueOf(exception.getRetryAfterSeconds()));
        }
        return builder.body(new ApiErrorResponse(
                exception.getCode(),
                exception.getMessage(),
                exception.getFieldErrors(),
                Instant.now(),
                request.getRequestURI()
        ));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> unreadable(
            HttpMessageNotReadableException exception,
            HttpServletRequest request
    ) {
        String code = classifyBindingFailure(exception);
        String message = switch (code) {
            case "UNKNOWN_FIELD" -> "Yêu cầu chứa trường không được hỗ trợ.";
            case "INVALID_ENUM_VALUE" -> "Giá trị enum không hợp lệ.";
            default -> "Nội dung yêu cầu không hợp lệ.";
        };
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .cacheControl(CacheControl.noStore())
                .body(new ApiErrorResponse(code, message, List.of(), Instant.now(), request.getRequestURI()));
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ApiErrorResponse> dataAccessFailure(
            DataAccessException exception,
            HttpServletRequest request
    ) {
        log.error("Database failure while processing feedback request {}", request.getRequestURI(), exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .cacheControl(CacheControl.noStore())
                .body(new ApiErrorResponse(
                        "INTERNAL_ERROR",
                        "Không thể xử lý góp ý lúc này.",
                        List.of(),
                        Instant.now(),
                        request.getRequestURI()
                ));
    }

    private String classifyBindingFailure(Throwable exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause.getMessage() != null && cause.getMessage().contains("Unknown Feedback field:")) {
                return "UNKNOWN_FIELD";
            }
            if (cause.getClass().getSimpleName().equals("UnrecognizedPropertyException")) {
                return "UNKNOWN_FIELD";
            }
            if (cause.getClass().getSimpleName().equals("InvalidFormatException")
                    && cause.getMessage() != null
                    && cause.getMessage().contains("GeneralFeedbackTargetType")) {
                return "INVALID_ENUM_VALUE";
            }
        }
        return "MALFORMED_REQUEST";
    }
}
