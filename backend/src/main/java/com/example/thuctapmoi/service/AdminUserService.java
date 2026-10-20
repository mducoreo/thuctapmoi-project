package com.example.thuctapmoi.service;

import com.example.thuctapmoi.dto.AdminUserPageResponse;
import com.example.thuctapmoi.dto.UserResponse;
import com.example.thuctapmoi.entity.User;
import com.example.thuctapmoi.entity.UserRole;
import com.example.thuctapmoi.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class AdminUserService {

    private final UserRepository repository;

    public AdminUserService(UserRepository repository) {
        this.repository = repository;
    }

    // Lấy danh sách tài khoản, có tìm kiếm và phân trang.
    @Transactional(readOnly = true)
    public AdminUserPageResponse list(
            String keyword,
            int page,
            int size,
            String actorUsername
    ) {
        requireAdmin(actorUsername);

        if (page < 0 || size < 1 || size > 50) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Trang phải từ 0 và số tài khoản mỗi trang từ 1 đến 50"
            );
        }

        String search = keyword == null ? "" : keyword.trim();

        if (search.length() > 50) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Từ khóa không được vượt quá 50 ký tự"
            );
        }

        var pageable = PageRequest.of(
                page,
                size,
                Sort.by("id").ascending()
        );

        var result = repository.findByUsernameContainingIgnoreCase(
                search,
                pageable
        );

        return new AdminUserPageResponse(
                result.getContent()
                        .stream()
                        .map(this::toResponse)
                        .toList(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages()
        );
    }

    // Đổi quyền của tài khoản được chọn.
    @Transactional
    public UserResponse changeRole(
            Long userId,
            UserRole role,
            String actorUsername
    ) {
        if (role == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Chọn quyền cho tài khoản"
            );
        }

        List<User> activeAdmins =
                repository.lockActiveAdmins(UserRole.ADMIN);

        User actor = requireAdmin(actorUsername);
        User target = findUser(userId);

        if (actor.getId().equals(target.getId())
                && role != UserRole.ADMIN) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Không thể tự hạ quyền tài khoản đang đăng nhập"
            );
        }

        if (role != UserRole.ADMIN) {
            protectLastAdmin(target, activeAdmins);
        }

        target.setRole(role);

        return toResponse(repository.saveAndFlush(target));
    }

    // Khóa hoặc mở khóa tài khoản được chọn.
    @Transactional
    public UserResponse changeEnabled(
            Long userId,
            boolean enabled,
            String actorUsername
    ) {
        List<User> activeAdmins =
                repository.lockActiveAdmins(UserRole.ADMIN);

        User actor = requireAdmin(actorUsername);
        User target = findUser(userId);

        if (actor.getId().equals(target.getId()) && !enabled) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Không thể tự khóa tài khoản đang đăng nhập"
            );
        }

        if (!enabled) {
            protectLastAdmin(target, activeAdmins);
        }

        target.setEnabled(enabled);

        return toResponse(repository.saveAndFlush(target));
    }

    // Hàm phụ: kiểm tra người đang thao tác là ADMIN hoạt động.
    private User requireAdmin(String username) {
        User user = repository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Tài khoản không tồn tại"
                ));

        if (!user.isEnabled()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Tài khoản đã bị khóa"
            );
        }

        if (user.getRole() != UserRole.ADMIN) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Chỉ ADMIN được quản lý tài khoản"
            );
        }

        return user;
    }

    // Hàm phụ: tìm tài khoản được chọn theo ID.
    private User findUser(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Tài khoản không tồn tại"
                ));
    }

    // Hàm phụ: giữ lại ít nhất một ADMIN đang hoạt động.
    private void protectLastAdmin(
            User target,
            List<User> activeAdmins
    ) {
        if (target.getRole() == UserRole.ADMIN
                && target.isEnabled()
                && activeAdmins.size() <= 1) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Hệ thống cần ít nhất một ADMIN đang hoạt động"
            );
        }
    }

    // Hàm phụ: chuyển tài khoản thành dữ liệu trả về frontend.
    private UserResponse toResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getRole(),
                user.isEnabled()
        );
    }
}