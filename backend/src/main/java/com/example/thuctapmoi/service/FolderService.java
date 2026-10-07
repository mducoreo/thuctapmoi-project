package com.example.thuctapmoi.service;

import com.example.thuctapmoi.dto.FolderRequest;
import com.example.thuctapmoi.dto.FolderResponse;
import com.example.thuctapmoi.entity.Folder;
import com.example.thuctapmoi.entity.User;
import com.example.thuctapmoi.entity.UserRole;
import com.example.thuctapmoi.repository.FolderRepository;
import com.example.thuctapmoi.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Objects;

@Service
@Transactional
public class FolderService {

    private final FolderRepository repository;
    private final UserRepository userRepository;

    public FolderService(
            FolderRepository repository,
            UserRepository userRepository
    ) {
        this.repository = repository;
        this.userRepository = userRepository;
    }

    // Không có parentId: lấy folder gốc.
    // Có parentId: lấy các folder con trực tiếp.
    @Transactional(readOnly = true)
    public List<FolderResponse> list(Long parentId, String username) {
        User actor = currentUser(username);
        List<Folder> folders;

        if (parentId == null) {
            folders = isAdmin(actor)
                    ? repository.findByParentIsNull()
                    : repository.findByOwnerIdAndParentIsNull(actor.getId());
        } else {
            Folder parent = findFolder(parentId);
            checkPermission(parent, actor);
            folders = repository.findByParentId(parentId);
        }

        return folders.stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public FolderResponse get(Long id, String username) {
        User actor = currentUser(username);
        Folder folder = findFolder(id);
        checkPermission(folder, actor);

        return toResponse(folder);
    }

    public FolderResponse create(FolderRequest request, String username) {
        User actor = currentUser(username);

        Folder parent = null;
        if (request.getParentId() != null) {
            parent = findFolder(request.getParentId());
            checkPermission(parent, actor);
        }

        Folder folder = new Folder();
        folder.setName(request.getName().trim());
        folder.setParent(parent);

        // Folder gốc thuộc người tạo.
        // Folder con cùng chủ sở hữu với folder cha.
        folder.setOwner(parent == null ? actor : parent.getOwner());

        return toResponse(repository.save(folder));
    }

    public FolderResponse update(
            Long id,
            FolderRequest request,
            String username
    ) {
        User actor = currentUser(username);
        Folder folder = findFolder(id);
        checkPermission(folder, actor);

        Folder parent = null;
        if (request.getParentId() != null) {
            parent = findFolder(request.getParentId());
            checkPermission(parent, actor);

            // Không chuyển folder sang cây của chủ sở hữu khác.
            if (!Objects.equals(
                    folder.getOwner().getId(),
                    parent.getOwner().getId()
            )) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Folder cha phải cùng chủ sở hữu"
                );
            }

            checkCycle(folder, parent);
        }

        folder.setName(request.getName().trim());
        folder.setParent(parent);

        return toResponse(repository.save(folder));
    }

    public void delete(Long id, String username) {
        User actor = currentUser(username);
        Folder folder = findFolder(id);
        checkPermission(folder, actor);

        if (repository.existsByParentId(id)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Phải xóa các folder con trước"
            );
        }

        repository.delete(folder);
    }

    private User currentUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Tài khoản không tồn tại"
                ));
    }

    private Folder findFolder(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Folder không tồn tại"
                ));
    }

    private boolean isAdmin(User user) {
        return user.getRole() == UserRole.ADMIN;
    }

    private void checkPermission(Folder folder, User actor) {
        boolean isOwner = Objects.equals(
                folder.getOwner().getId(),
                actor.getId()
        );

        if (!isAdmin(actor) && !isOwner) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Không có quyền truy cập folder này"
            );
        }
    }

    // Đi ngược từ cha mới lên gốc.
    // Nếu gặp chính folder đang sửa thì sẽ tạo vòng lặp.
    private void checkCycle(Folder folder, Folder newParent) {
        Folder current = newParent;

        while (current != null) {
            if (Objects.equals(current.getId(), folder.getId())) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Không thể đặt folder vào chính nó hoặc folder con của nó"
                );
            }

            current = current.getParent();
        }
    }

    private FolderResponse toResponse(Folder folder) {
        return new FolderResponse(
                folder.getId(),
                folder.getName(),
                folder.getParent() == null
                        ? null
                        : folder.getParent().getId(),
                folder.getOwner().getId(),
                folder.getOwner().getUsername()
        );
    }
}