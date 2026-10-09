package com.example.thuctapmoi.service;

import com.example.thuctapmoi.dto.DocumentResponse;
import com.example.thuctapmoi.entity.Document;
import com.example.thuctapmoi.entity.Folder;
import com.example.thuctapmoi.entity.User;
import com.example.thuctapmoi.repository.DocumentRepository;
import com.example.thuctapmoi.repository.FolderRepository;
import com.example.thuctapmoi.repository.UserRepository;
import org.apache.tika.Tika;
import org.apache.tika.io.TikaInputStream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class DocumentService {

    // 10 MB, khớp với giới hạn đã đặt trong application.properties
    private static final long MAX_FILE_SIZE = 10L * 1024 * 1024;

    // Đuôi file và MIME tương ứng được phép upload
    private static final Map<String, String> ALLOWED_TYPES = Map.of(
            "pdf", "application/pdf",
            "doc", "application/msword",
            "docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "jpg", "image/jpeg",
            "jpeg", "image/jpeg",
            "png", "image/png"
    );

    private final DocumentRepository documentRepository;
    private final FolderRepository folderRepository;
    private final UserRepository userRepository;

    private final Path uploadDir;

    private final Tika tika = new Tika();

    public DocumentService(
            DocumentRepository documentRepository,
            FolderRepository folderRepository,
            UserRepository userRepository,
            @Value("${app.storage.upload-dir}") String uploadDir
    ) {
        this.documentRepository = documentRepository;
        this.folderRepository = folderRepository;
        this.userRepository = userRepository;

        this.uploadDir = Path.of(uploadDir)
                .toAbsolutePath()
                .normalize();
    }

    // 1. Upload một tài liệu vào thư mục
    public DocumentResponse upload(
            Long folderId,
            MultipartFile file,
            String username
    ) {
        User user = currentUser(username);
        Folder folder = ownedFolder(folderId, user);

        // Kiểm tra rỗng và dung lượng
        validateSize(file);

        // Lấy tên gốc và kiểm tra đuôi file
        String originalName = originalName(file);
        String extension = extension(originalName);

        Path savedPath = null;

        try {
            // Đọc nội dung file
            byte[] content = file.getBytes();

            // Nhận diện MIME từ nội dung
            String mimeType;

            try (TikaInputStream input = TikaInputStream.get(content)) {
                mimeType = tika.detect(input);
            }

            // MIME phải khớp với đuôi file
            String expectedMime = ALLOWED_TYPES.get(extension);

            if (!expectedMime.equals(mimeType)) {
                throw new ResponseStatusException(
                        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                        "Nội dung file không phù hợp với định dạng đã chọn"
                );
            }

            // Tự tạo thư mục lưu file nếu chưa có
            Files.createDirectories(uploadDir);

            // Tạo file với tên ngẫu nhiên, không ghi đè file đã có
            savedPath = Files.createTempFile(
                    uploadDir,
                    "document-",
                    "." + extension
            );

            // Ghi nội dung vào file vừa tạo
            Files.write(savedPath, content);

            // Tạo entity chứa thông tin tài liệu
            Document document = new Document();

            document.setOriginalName(originalName);
            document.setStoredName(savedPath.getFileName().toString());
            document.setMimeType(mimeType);
            document.setSize((long) content.length);
            document.setFolder(folder);
            document.setOwner(user);
            document.setUploadedAt(LocalDateTime.now());

            // Lưu thông tin vào database
            Document saved = documentRepository.saveAndFlush(document);

            return toResponse(saved);

        } catch (IOException exception) {
            removeFailedUpload(savedPath, exception);

            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Không thể đọc hoặc lưu file",
                    exception
            );

        } catch (RuntimeException exception) {
            // Nếu lưu database thất bại, xóa file vừa tạo
            removeFailedUpload(savedPath, exception);
            throw exception;
        }
    }

    // 2. Lấy danh sách tài liệu trong một thư mục
    @Transactional(readOnly = true)
    public List<DocumentResponse> list(
            Long folderId,
            String username
    ) {
        User user = currentUser(username);

        // Phải kiểm tra quyền trước khi lấy danh sách
        ownedFolder(folderId, user);

        return documentRepository
                .findByFolder_IdOrderByUploadedAtDesc(folderId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // 3. Tìm tài khoản đang thực hiện thao tác
    private User currentUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Tài khoản không tồn tại"
                ));
    }

    // 4. Tìm thư mục và kiểm tra người sở hữu
    private Folder ownedFolder(Long folderId, User user) {
        Folder folder = folderRepository.findById(folderId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Thư mục không tồn tại"
                ));

        if (!folder.getOwner().getId().equals(user.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền truy cập thư mục này"
            );
        }

        return folder;
    }

    // 5. Kiểm tra file rỗng và dung lượng
    private void validateSize(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vui lòng chọn file có dữ liệu"
            );
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new ResponseStatusException(
                    HttpStatus.PAYLOAD_TOO_LARGE,
                    "Dung lượng file không được vượt quá 10 MB"
            );
        }
    }

    // 6. Lấy tên file, bỏ phần đường dẫn nếu có
    private String originalName(MultipartFile file) {
        String name = file.getOriginalFilename();

        if (name == null || name.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Tên file không hợp lệ"
            );
        }

        name = name.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1);

        if (name.isBlank() || name.length() > 255
                || name.chars().anyMatch(Character::isISOControl)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Tên file không hợp lệ hoặc dài quá 255 ký tự"
            );
        }

        return name;
    }

    // 7. Lấy và kiểm tra đuôi file
    private String extension(String name) {
        int dotIndex = name.lastIndexOf('.');

        if (dotIndex <= 0 || dotIndex == name.length() - 1) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "File phải có phần mở rộng"
            );
        }

        String extension = name.substring(dotIndex + 1)
                .toLowerCase(Locale.ROOT);

        if (!ALLOWED_TYPES.containsKey(extension)) {
            throw new ResponseStatusException(
                    HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "Chỉ hỗ trợ PDF, DOC, DOCX, JPG, JPEG và PNG"
            );
        }

        return extension;
    }

    // 8. Chuyển entity thành DTO trả về frontend
    private DocumentResponse toResponse(Document document) {
        return new DocumentResponse(
                document.getId(),
                document.getOriginalName(),
                document.getMimeType(),
                document.getSize(),
                document.getFolder().getId(),
                document.getUploadedAt()
        );
    }

    // 9. Dọn file vừa tạo nếu upload thất bại
    private void removeFailedUpload(Path path, Exception originalError) {
        if (path == null) {
            return;
        }

        try {
            Files.deleteIfExists(path);
        } catch (IOException cleanupError) {
            originalError.addSuppressed(cleanupError);
        }
    }
}