package com.example.thuctapmoi.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminUserEnabledRequest {

    @NotNull(message = "Trạng thái tài khoản không được để trống")
    private Boolean enabled;
}