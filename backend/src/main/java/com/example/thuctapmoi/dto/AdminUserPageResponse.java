package com.example.thuctapmoi.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

@Getter
@AllArgsConstructor
public class AdminUserPageResponse {

    private final List<UserResponse> content;

    private final int page;

    private final int size;

    private final long totalElements;

    private final int totalPages;
}