package com.example.thuctapmoi.controller;

import com.example.thuctapmoi.dto.AdminUserEnabledRequest;
import com.example.thuctapmoi.dto.AdminUserPageResponse;
import com.example.thuctapmoi.dto.AdminUserRoleRequest;
import com.example.thuctapmoi.dto.UserResponse;
import com.example.thuctapmoi.service.AdminUserService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admin/users")
public class AdminUserController {

    private final AdminUserService service;

    public AdminUserController(AdminUserService service) {
        this.service = service;
    }

    // Lấy danh sách tài khoản, có tìm kiếm và phân trang.
    @GetMapping
    public AdminUserPageResponse list(
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            Authentication authentication
    ) {
        return service.list(
                keyword,
                page,
                size,
                authentication.getName()
        );
    }

    // Đổi quyền của tài khoản.
    @PatchMapping("/{id}/role")
    public UserResponse changeRole(
            @PathVariable Long id,
            @Valid @RequestBody AdminUserRoleRequest request,
            Authentication authentication
    ) {
        return service.changeRole(
                id,
                request.getRole(),
                authentication.getName()
        );
    }

    // Khóa hoặc mở khóa tài khoản.
    @PatchMapping("/{id}/enabled")
    public UserResponse changeEnabled(
            @PathVariable Long id,
            @Valid @RequestBody AdminUserEnabledRequest request,
            Authentication authentication
    ) {
        return service.changeEnabled(
                id,
                request.getEnabled(),
                authentication.getName()
        );
    }
}