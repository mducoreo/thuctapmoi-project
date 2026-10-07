package com.example.thuctapmoi.service;

import com.example.thuctapmoi.dto.AuthRequest;
import com.example.thuctapmoi.dto.AuthResponse;
import com.example.thuctapmoi.dto.RefreshTokenRequest;
import com.example.thuctapmoi.dto.UserResponse;
import com.example.thuctapmoi.entity.User;
import com.example.thuctapmoi.entity.UserRole;
import com.example.thuctapmoi.repository.UserRepository;
import com.example.thuctapmoi.security.JwtService;
import io.jsonwebtoken.JwtException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;

@Service
public class AuthService {
    private final UserRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(
            UserRepository repository,
            PasswordEncoder passwordEncoder,
             JwtService jwtService
    ) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public UserResponse register(AuthRequest request) {
        //kiem tra dang nhap ton tai chua
        if (repository.existsByUsername(request.getUsername())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "TEN DANG NHAP TON TAI"
            );
        }
        // mat khau ko qua 72byte
        if (request.getPassword()
                .getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Mật khẩu không được vượt quá 72 byte UTF-8"
            );
        }
        // tao doi tuong tk
        User user = new User();
        user.setUsername((request.getUsername()));

        //bam mk
        String hashedPassword =
                passwordEncoder.encode(request.getPassword());

        user.setPassword(hashedPassword);
        user.setRole(UserRole.USER);

        //xuong dtb
        User saved;
        try {
            saved = repository.saveAndFlush(user);
        } catch (DataIntegrityViolationException exception) {
            // Xử lý trường hợp hai yêu cầu cùng đăng ký một username.
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Không thể tạo tài khoản: dữ liệu bị trùng hoặc không hợp lệ"
            );
        }
        //tra id va username cua tak da luu
        return new UserResponse(
                saved.getId(),
                saved.getUsername()
        );
    }
    public AuthResponse login(AuthRequest request) {

        // 1. Tìm tài khoản.
        User user = repository
                .findByUsername(request.getUsername())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Sai username hoặc mật khẩu"
                ));

        // 2. Kiểm tra mật khẩu.
        if (request.getPassword()
                .getBytes(StandardCharsets.UTF_8).length > 72
                || !passwordEncoder.matches(
                request.getPassword(),
                user.getPassword()
        )) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Sai username hoặc mật khẩu"
            );
        }

        // 3. Tạo hai token.
        String accessToken =
                jwtService.generateAccessToken(user.getUsername());

        String refreshToken =
                jwtService.generateRefreshToken(user.getUsername());

        // 4. Trả hai token về frontend.
        return new AuthResponse(accessToken, refreshToken);
    }

    public AuthResponse refreshToken(RefreshTokenRequest request) {

        String refreshToken = request.getRefreshToken();

        // 1. Kiểm tra chữ ký, hạn và loại token; lấy username.
        String username;
        try {
            username = jwtService.extractRefreshUsername(refreshToken);
        } catch (JwtException | IllegalArgumentException exception) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Refresh token không hợp lệ hoặc đã hết hạn"
            );
        }

        // 2. Kiểm tra tài khoản vẫn tồn tại.
        User user = repository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Tài khoản không tồn tại"
                ));

        // 3. Tạo access token mới.
        String newAccessToken =
                jwtService.generateAccessToken(user.getUsername());

        // 4. Trả access token mới cùng refresh token hiện tại.
        return new AuthResponse(newAccessToken, refreshToken);
    }
    public UserResponse me(String username) {
        User user = repository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Tài khoản không tồn tại"
                ));

        return new UserResponse(
                user.getId(),
                user.getUsername()
        );
    }
}

