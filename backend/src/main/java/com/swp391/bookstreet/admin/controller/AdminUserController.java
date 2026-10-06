package com.swp391.bookstreet.admin.controller;

import com.swp391.bookstreet.admin.dto.AdminCreateUserRequest;
import com.swp391.bookstreet.admin.dto.AdminStatusUpdateRequest;
import com.swp391.bookstreet.admin.dto.AdminUpdateUserRequest;
import com.swp391.bookstreet.admin.dto.AdminUserDto;
import com.swp391.bookstreet.admin.service.AdminUserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/users")
public class AdminUserController {

    private final AdminUserService adminUserService;

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @GetMapping
    public ResponseEntity<List<AdminUserDto>> getAllUsers() {
        return ResponseEntity.ok(adminUserService.getAllUsers());
    }

    @PostMapping
    public ResponseEntity<AdminUserDto> createUser(@Valid @RequestBody AdminCreateUserRequest request) {
        AdminUserDto created = adminUserService.createUser(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PatchMapping("/{userId}")
    public ResponseEntity<AdminUserDto> updateUser(
            @PathVariable Long userId,
            @RequestBody AdminUpdateUserRequest request
    ) {
        return ResponseEntity.ok(adminUserService.updateUser(userId, request));
    }

    @PatchMapping("/{userId}/status")
    public ResponseEntity<Map<String, String>> updateUserStatus(
            @PathVariable Long userId,
            @RequestBody AdminStatusUpdateRequest request
    ) {
        adminUserService.updateUserStatus(userId, request);
        return ResponseEntity.ok(Map.of("message", "Cập nhật trạng thái người dùng thành công"));
    }

    @PostMapping("/{userId}/reset-password")
    public ResponseEntity<Map<String, Object>> resetPassword(@PathVariable Long userId) {
        adminUserService.resetPassword(userId);
        return ResponseEntity.ok(Map.of(
                "message", "Mật khẩu đã được đặt lại thành công về mặc định (BookStreet@123)",
                "resetToken", "dummy-token",
                "expiresInMinutes", 60
        ));
    }
}
