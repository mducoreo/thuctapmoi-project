package com.example.thuctapmoi.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;

@Service
public class JwtService {

    private final SecretKey secretKey;

    private static final long ACCESS_TOKEN_EXPIRATION =
            15 * 60 * 1000L;

    private static final long REFRESH_TOKEN_EXPIRATION =
            7 * 24 * 60 * 60 * 1000L;

    public JwtService(@Value("${jwt.secret}") String secret) {
        this.secretKey = Keys.hmacShaKeyFor(
                Decoders.BASE64.decode(secret)
        );
    }

    public String generateAccessToken(String username) {
        return generateToken(
                username,
                "ACCESS",
                ACCESS_TOKEN_EXPIRATION
        );
    }

    public String generateRefreshToken(String username) {
        return generateToken(
                username,
                "REFRESH",
                REFRESH_TOKEN_EXPIRATION
        );
    }

    private String generateToken(
            String username,
            String type,
            long duration
    ) {
        Date now = new Date();

        return Jwts.builder()
                .subject(username)
                .claim("type", type)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + duration))
                .signWith(secretKey, Jwts.SIG.HS256)
                .compact();
    }

    private Claims extractClaims(String token, String expectedType) {
        Claims claims = Jwts.parser()
                .verifyWith(secretKey)
                .require("type", expectedType)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        if (claims.getExpiration() == null
                || !claims.getExpiration().after(new Date())
                || claims.getSubject() == null
                || claims.getSubject().isBlank()) {
            throw new JwtException("Token không hợp lệ");
        }

        return claims;
    }

    // Dùng khi xác thực request bằng access token.
    public String extractUsername(String accessToken) {
        return extractClaims(accessToken, "ACCESS").getSubject();
    }

    // Dùng khi yêu cầu cấp lại access token.
    public String extractRefreshUsername(String refreshToken) {
        return extractClaims(refreshToken, "REFRESH").getSubject();
    }

    public boolean isTokenValid(String accessToken) {
        try {
            extractClaims(accessToken, "ACCESS");
            return true;
        } catch (JwtException | IllegalArgumentException exception) {
            return false;
        }
    }

    public boolean isRefreshTokenValid(String refreshToken) {
        try {
            extractClaims(refreshToken, "REFRESH");
            return true;
        } catch (JwtException | IllegalArgumentException exception) {
            return false;
        }
    }
}