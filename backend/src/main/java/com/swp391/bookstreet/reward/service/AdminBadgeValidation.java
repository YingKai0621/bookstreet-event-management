package com.swp391.bookstreet.reward.service;

import com.swp391.bookstreet.reward.dto.AdminBadgeRequest;
import com.swp391.bookstreet.reward.exception.BadgeValidationException;
import com.swp391.bookstreet.reward.exception.BadgeValidationException.Violation;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;

final class AdminBadgeValidation {
    private AdminBadgeValidation() { }

    static AdminBadgeRequest normalize(AdminBadgeRequest request) {
        List<Violation> errors = new ArrayList<>();
        String name = request.name() == null ? null : request.name().trim().replaceAll("\\s+", " ");
        if (name == null) errors.add(new Violation("name", "REQUIRED", "Tên huy hiệu là bắt buộc."));
        else if (name.isEmpty()) errors.add(new Violation("name", "NOT_BLANK", "Tên huy hiệu không được để trống."));
        else if (name.length() > 100) errors.add(new Violation("name", "LENGTH", "Tên huy hiệu tối đa 100 ký tự."));
        String description = optional(request.description());
        if (description != null && description.length() > 1000) {
            errors.add(new Violation("description", "LENGTH", "Mô tả tối đa 1000 ký tự."));
        }
        String iconUrl = optional(request.iconUrl());
        if (iconUrl != null) {
            if (iconUrl.length() > 2048) errors.add(new Violation("iconUrl", "LENGTH", "Đường dẫn tối đa 2048 ký tự."));
            else if (!validUrl(iconUrl)) errors.add(new Violation("iconUrl", "URL", "Ảnh phải là đường dẫn HTTP hoặc HTTPS đầy đủ."));
        }
        if (request.requiredPoints() == null) errors.add(new Violation("requiredPoints", "REQUIRED", "Ngưỡng điểm là bắt buộc."));
        else if (request.requiredPoints() <= 0) errors.add(new Violation("requiredPoints", "RANGE", "Ngưỡng điểm phải là số nguyên dương."));
        if (request.isActive() == null) errors.add(new Violation("isActive", "REQUIRED", "Trạng thái là bắt buộc."));
        if (!errors.isEmpty()) throw new BadgeValidationException(errors);
        return new AdminBadgeRequest(name, description, request.requiredPoints(), iconUrl, request.isActive());
    }

    private static String optional(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim();
    }

    private static boolean validUrl(String value) {
        try {
            URI uri = URI.create(value);
            return ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null;
        } catch (IllegalArgumentException error) { return false; }
    }
}
