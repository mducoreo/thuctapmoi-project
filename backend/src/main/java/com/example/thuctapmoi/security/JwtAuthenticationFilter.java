package com.example.thuctapmoi.security;

import com.example.thuctapmoi.entity.User;
import com.example.thuctapmoi.repository.UserRepository;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository repository;

    public JwtAuthenticationFilter(
            JwtService jwtService,
            UserRepository repository
    ) {
        this.jwtService = jwtService;
        this.repository = repository;
    }

    // Các API này không cần access token.
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();

        return path.equals("/auth/register")
                || path.equals("/auth/login")
                || path.equals("/auth/refresh")
                || path.equals("/error");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        // 1. Lấy header Authorization.
        String header = request.getHeader("Authorization");

        // Chưa có token: để SecurityConfig xử lý quyền truy cập.
        if (header == null) {
            filterChain.doFilter(request, response);
            return;
        }

        if (!header.startsWith("Bearer ")) {
            response.sendError(
                    HttpServletResponse.SC_UNAUTHORIZED,
                    "Authorization phải có dạng Bearer <accessToken>"
            );
            return;
        }

        // 2. Bỏ phần "Bearer " để lấy token.
        String token = header.substring(7);

        // 3. Kiểm tra token và lấy username.
        String username;
        try {
            username = jwtService.extractUsername(token);
        } catch (JwtException | IllegalArgumentException exception) {
            response.sendError(
                    HttpServletResponse.SC_UNAUTHORIZED,
                    "Access token không hợp lệ hoặc đã hết hạn"
            );
            return;
        }

        // 4. Kiểm tra tài khoản vẫn tồn tại.
        User user = repository.findByUsername(username).orElse(null);

        if (user == null) {
            response.sendError(
                    HttpServletResponse.SC_UNAUTHORIZED,
                    "Tài khoản không tồn tại"
            );
            return;
        }

        // 5. Ghi nhận người dùng đã được xác thực.
        var authentication =
                new UsernamePasswordAuthenticationToken(
                        user.getUsername(),
                        null,
                        List.of()
                );

        authentication.setDetails(
                new WebAuthenticationDetailsSource()
                        .buildDetails(request)
        );

        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);

        // 6. Cho request đi tiếp.
        filterChain.doFilter(request, response);
    }
}