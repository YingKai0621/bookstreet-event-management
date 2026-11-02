package com.swp391.bookstreet.heritage.exception;

import com.swp391.bookstreet.common.response.ApiErrorResponse;
import com.swp391.bookstreet.common.response.FieldValidationError;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(basePackages = "com.swp391.bookstreet.heritage.controller")
public class HeritageApiExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(HeritageApiExceptionHandler.class);

    @ExceptionHandler(HeritageApiException.class)
    public ResponseEntity<ApiErrorResponse> heritage(
            HeritageApiException exception,
            HttpServletRequest request
    ) {
        return ResponseEntity.status(exception.getStatus())
                .cacheControl(CacheControl.noStore())
                .body(new ApiErrorResponse(
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
        String code = isUnknownField(exception) ? "UNKNOWN_FIELD" : "MALFORMED_REQUEST";
        String message = "UNKNOWN_FIELD".equals(code)
                ? "Yêu cầu chứa trường không được hỗ trợ."
                : "Nội dung yêu cầu không hợp lệ.";
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .cacheControl(CacheControl.noStore())
                .body(new ApiErrorResponse(code, message, List.of(), Instant.now(), request.getRequestURI()));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiErrorResponse> oversizedUpload(
            MaxUploadSizeExceededException exception,
            HttpServletRequest request
    ) {
        String message = "Ảnh di sản không được vượt quá 5 MB.";
        return ResponseEntity.unprocessableContent()
                .cacheControl(CacheControl.noStore())
                .body(new ApiErrorResponse(
                        "HERITAGE_IMAGE_INVALID",
                        message,
                        List.of(new FieldValidationError("file", message)),
                        Instant.now(),
                        request.getRequestURI()
                ));
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ApiErrorResponse> database(
            DataAccessException exception,
            HttpServletRequest request
    ) {
        log.error(
                "Database failure while processing Heritage request {} with type {}",
                request.getRequestURI(),
                exception.getClass().getSimpleName()
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .cacheControl(CacheControl.noStore())
                .body(new ApiErrorResponse(
                        "INTERNAL_ERROR",
                        "Không thể xử lý nội dung di sản lúc này.",
                        List.of(),
                        Instant.now(),
                        request.getRequestURI()
                ));
    }

    private boolean isUnknownField(Throwable exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause.getMessage() != null && cause.getMessage().contains("Unknown Heritage field:")) {
                return true;
            }
            if (cause.getClass().getSimpleName().equals("UnrecognizedPropertyException")) {
                return true;
            }
        }
        return false;
    }
}
