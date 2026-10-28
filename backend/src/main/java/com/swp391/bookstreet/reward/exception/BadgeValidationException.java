package com.swp391.bookstreet.reward.exception;

import java.util.List;

public class BadgeValidationException extends RuntimeException {
    private final List<Violation> violations;

    public BadgeValidationException(List<Violation> violations) {
        super("Dữ liệu huy hiệu không hợp lệ.");
        this.violations = List.copyOf(violations);
    }

    public List<Violation> getViolations() { return violations; }
    public record Violation(String field, String code, String message) { }
}
