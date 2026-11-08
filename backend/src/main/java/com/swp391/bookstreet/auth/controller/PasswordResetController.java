package com.swp391.bookstreet.auth.controller;

import com.swp391.bookstreet.auth.dto.PasswordResetConfirmRequest;
import com.swp391.bookstreet.auth.dto.PasswordResetRequest;
import com.swp391.bookstreet.auth.service.PasswordResetService;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth/password-reset")
public class PasswordResetController {
    static final String NEUTRAL_MESSAGE =
            "Nếu email hợp lệ, hướng dẫn đặt lại mật khẩu sẽ được gửi đến hộp thư của bạn.";

    private final PasswordResetService service;

    public PasswordResetController(PasswordResetService service) {
        this.service = service;
    }

    @PostMapping("/request")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Map<String, String> request(@Valid @RequestBody PasswordResetRequest request) {
        service.request(request.email());
        return Map.of("message", NEUTRAL_MESSAGE);
    }

    @PostMapping("/confirm")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void confirm(@Valid @RequestBody PasswordResetConfirmRequest request) {
        service.confirm(request);
    }
}
