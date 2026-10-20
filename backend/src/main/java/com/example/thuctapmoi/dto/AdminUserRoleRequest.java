package com.example.thuctapmoi.dto;

import com.example.thuctapmoi.entity.UserRole;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminUserRoleRequest {

    @NotNull(message = "Chọn quyền cho tài khoản")
    private UserRole role;
}