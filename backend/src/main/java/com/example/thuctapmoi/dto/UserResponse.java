package com.example.thuctapmoi.dto;

public class UserResponse {

    private final Long id;
    private final String username;

    public UserResponse(Long id, String username) {
        this.id = id;
        this.username = username;
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }
}