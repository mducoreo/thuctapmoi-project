package com.example.thuctapmoi.controller;

import com.example.thuctapmoi.dto.AuthRequest;
import com.example.thuctapmoi.dto.AuthResponse;
import com.example.thuctapmoi.dto.RefreshTokenRequest;
import com.example.thuctapmoi.dto.UserResponse;
import com.example.thuctapmoi.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService service;

    public AuthController(AuthService service) {
        this.service = service;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse register(
            @Valid @RequestBody AuthRequest request
    ) {
        return service.register(request);
    }
    @PostMapping("/login")
    public AuthResponse login(
            @Valid @RequestBody AuthRequest request
    ) {
        return service.login(request);
    }

    @PostMapping("/refresh")
    public AuthResponse refreshToken(
            @Valid @RequestBody RefreshTokenRequest request
    ) {
        return service.refreshToken(request);
    }
    @GetMapping("/me")
    public UserResponse me(Authentication authentication) {
        return service.me(authentication.getName());
    }
}