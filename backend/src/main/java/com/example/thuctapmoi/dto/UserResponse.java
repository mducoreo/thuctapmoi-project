package com.example.thuctapmoi.dto;

import com.example.thuctapmoi.entity.UserRole;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class UserResponse {

    private final Long id;

    private final String username;

    private final UserRole role;

    private final boolean enabled;
}