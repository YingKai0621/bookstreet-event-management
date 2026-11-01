package com.swp391.bookstreet.heritage.service;

import com.swp391.bookstreet.common.response.FieldValidationError;
import com.swp391.bookstreet.heritage.exception.HeritageApiException;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class HeritageValidationService {
    private static final Pattern PUBLIC_CODE = Pattern.compile("^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$");
    private static final Pattern HORIZONTAL_WHITESPACE = Pattern.compile("\\h+");
    private static final Pattern CONTROL_CHARACTER = Pattern.compile("[\\p{Cntrl}]");

    public String publicCode(String value) {
        String normalized = value == null ? null : value.strip().toUpperCase(Locale.ROOT);
        if (normalized == null || normalized.length() < 3 || normalized.length() > 100
                || !PUBLIC_CODE.matcher(normalized).matches()) {
            throw validation("publicCode", "Mã công khai phải dài từ 3 đến 100 ký tự và đúng định dạng.");
        }
        return normalized;
    }

    public boolean isCanonicalPublicCode(String value) {
        return value != null
                && value.length() >= 3
                && value.length() <= 100
                && PUBLIC_CODE.matcher(value).matches();
    }

    public String title(String value) {
        if (value == null) {
            throw validation("title", "Tiêu đề là bắt buộc.");
        }
        String normalized = HORIZONTAL_WHITESPACE.matcher(value.strip()).replaceAll(" ");
        int length = codePoints(normalized);
        if (length < 2 || length > 200) {
            throw validation("title", "Tiêu đề phải có từ 2 đến 200 ký tự.");
        }
        return normalized;
    }

    public String summary(String value) {
        return optionalText(value, 1000, "summary", "Tóm tắt không được vượt quá 1.000 ký tự.");
    }

    public String content(String value) {
        if (value == null) {
            throw validation("content", "Nội dung là bắt buộc.");
        }
        String normalized = value.replace("\r\n", "\n").replace('\r', '\n').strip();
        int length = codePoints(normalized);
        if (length < 20 || length > 20000) {
            throw validation("content", "Nội dung phải có từ 20 đến 20.000 ký tự.");
        }
        return normalized;
    }

    public String imageUrl(String value) {
        String normalized = optionalText(
                value,
                2048,
                "imageUrl",
                "Đường dẫn ảnh không được vượt quá 2.048 ký tự."
        );
        if (normalized == null) return null;

        boolean validLocal = normalized.startsWith("/assets/heritage/")
                && normalized.length() > "/assets/heritage/".length()
                && !normalized.contains("\\")
                && !normalized.contains("?")
                && !normalized.contains("#")
                && !normalized.toLowerCase(Locale.ROOT).contains("%2e")
                && !containsDotSegment(normalized)
                && !CONTROL_CHARACTER.matcher(normalized).find();
        if (validLocal) return normalized;

        try {
            URI uri = new URI(normalized);
            boolean validRemote = uri.isAbsolute()
                    && ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null
                    && !uri.getHost().isBlank();
            if (validRemote) return normalized;
        } catch (URISyntaxException ignored) {
            // Stable validation error below.
        }
        throw validation("imageUrl", "Đường dẫn ảnh phải là URL HTTP, HTTPS hoặc tài nguyên Heritage hợp lệ.");
    }

    public String locationText(String value) {
        return optionalText(value, 255, "locationText", "Địa điểm không được vượt quá 255 ký tự.");
    }

    public Instant expectedUpdatedAt(String value) {
        if (value == null || value.isBlank()) {
            throw validation("expectedUpdatedAt", "Thời điểm cập nhật gần nhất là bắt buộc.");
        }
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException exception) {
            throw validation("expectedUpdatedAt", "Thời điểm cập nhật gần nhất không hợp lệ.");
        }
    }

    public HeritageApiException validation(String field, String message) {
        return new HeritageApiException(
                HttpStatus.UNPROCESSABLE_ENTITY,
                "VALIDATION_FAILED",
                "Dữ liệu không hợp lệ.",
                List.of(new FieldValidationError(field, message))
        );
    }

    public HeritageApiException emptyUpdate() {
        return new HeritageApiException(
                HttpStatus.UNPROCESSABLE_ENTITY,
                "VALIDATION_FAILED",
                "Dữ liệu không hợp lệ."
        );
    }

    private String optionalText(String value, int maximum, String field, String message) {
        if (value == null) return null;
        String normalized = value.strip();
        if (normalized.isEmpty()) return null;
        if (codePoints(normalized) > maximum) throw validation(field, message);
        return normalized;
    }

    private int codePoints(String value) {
        return value.codePointCount(0, value.length());
    }

    private boolean containsDotSegment(String value) {
        for (String segment : value.split("/", -1)) {
            if (".".equals(segment) || "..".equals(segment)) return true;
        }
        return false;
    }
}
