package com.example.thuctapmoi.service;

import com.example.thuctapmoi.dto.DocumentMetadataRequest;
import com.example.thuctapmoi.dto.DocumentMoveRequest;
import com.example.thuctapmoi.dto.DocumentRenameRequest;
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
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class DocumentService {

    private static final long MAX_FILE_SIZE = 10L * 1024 * 1024;

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

    // ===== CÁC METHOD CHÍNH =====

    // 1. Upload file kèm metadata.
    public DocumentResponse upload(
            Long folderId,
            MultipartFile file,
            DocumentMetadataRequest request,
            String username
    ) {
        User user = currentUser(username);
        Folder folder = ownedFolder(folderId, user);

        validateSize(file);

        String originalName = originalName(file);
        String extension = extension(originalName);
        Path savedPath = null;

        try {
            byte[] content = file.getBytes();
            String mimeType;

            try (TikaInputStream input = TikaInputStream.get(content)) {
                mimeType = tika.detect(input);
            }

            String expectedMime = ALLOWED_TYPES.get(extension);

            if (!expectedMime.equals(mimeType)) {
                throw new ResponseStatusException(
                        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                        "Nội dung file không phù hợp với định dạng đã chọn"
                );
            }

            Path folderPath = uploadDir.resolve("folder-" + folderId);
            Files.createDirectories(folderPath);

            savedPath = Files.createTempFile(
                    folderPath,
                    "document-",
                    "." + extension
            );

            Files.write(savedPath, content);

            Document document = new Document();
            document.setOriginalName(originalName);
            document.setStoredName(
                    uploadDir.relativize(savedPath)
                            .toString()
                            .replace('\\', '/')
            );
            document.setMimeType(mimeType);
            document.setSize((long) content.length);
            document.setFolder(folder);
            document.setOwner(user);
            document.setUploadedAt(LocalDateTime.now());

            applyMetadata(document, request);

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
            removeFailedUpload(savedPath, exception);
            throw exception;
        }
    }

    // 2. Danh sách tài liệu chưa bị xóa.
    @Transactional(readOnly = true)
    public List<DocumentResponse> list(
            Long folderId,
            String username
    ) {
        User user = currentUser(username);
        ownedFolder(folderId, user);

        return documentRepository
                .findByFolder_IdAndDeletedAtIsNullOrderByUploadedAtDesc(
                        folderId
                )
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // 3. Lấy chi tiết.
    @Transactional(readOnly = true)
    public DocumentResponse detail(
            Long folderId,
            Long documentId,
            String username
    ) {
        User user = currentUser(username);
        Document document = ownedDocument(folderId, documentId, user);

        return toResponse(document);
    }

    // 4. Sửa metadata.
    @Transactional
    public DocumentResponse updateMetadata(
            Long folderId,
            Long documentId,
            DocumentMetadataRequest request,
            String username
    ) {
        User user = currentUser(username);
        Document document = ownedDocument(folderId, documentId, user);

        applyMetadata(document, request);

        return toResponse(documentRepository.saveAndFlush(document));
    }

    // 5. Đổi tên file hiển thị, giữ nguyên tên lưu trên ổ đĩa.
    @Transactional
    public DocumentResponse rename(
            Long folderId,
            Long documentId,
            DocumentRenameRequest request,
            String username
    ) {
        User user = currentUser(username);
        Document document = ownedDocument(folderId, documentId, user);

        String name = validateRename(
                request.getOriginalName(),
                document.getOriginalName()
        );

        document.setOriginalName(name);

        return toResponse(documentRepository.saveAndFlush(document));
    }

    // 6. Chuyển tài liệu sang thư mục khác.
    @Transactional
    public DocumentResponse move(
            Long folderId,
            Long documentId,
            DocumentMoveRequest request,
            String username
    ) {
        User user = currentUser(username);

        Document document = ownedDocument(folderId, documentId, user);

        // Thư mục đích phải tồn tại và thuộc người đang đăng nhập.
        Folder targetFolder = ownedFolder(
                request.getTargetFolderId(),
                user
        );

        if (document.getFolder().getId().equals(targetFolder.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Tài liệu đã nằm trong thư mục này"
            );
        }

        // Chỉ thay thư mục quản lý trong database.
        // storedName vẫn giữ đường dẫn tới file thật.
        document.setFolder(targetFolder);

        return toResponse(documentRepository.saveAndFlush(document));
    }

    // 7. Xóa mềm: giữ bản ghi và file, đánh dấu thời điểm xóa.
    @Transactional
    public void delete(
            Long folderId,
            Long documentId,
            String username
    ) {
        User user = currentUser(username);
        Document document = ownedDocument(folderId, documentId, user);

        document.setDeletedAt(LocalDateTime.now());
        documentRepository.saveAndFlush(document);
    }

    // 8. Xem nội dung file.
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> content(
            Long folderId,
            Long documentId,
            String username
    ) {
        User user = currentUser(username);
        Document document = ownedDocument(folderId, documentId, user);

        return fileResponse(document, false);
    }

    // 9. Tải xuống file.
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> download(
            Long folderId,
            Long documentId,
            String username
    ) {
        User user = currentUser(username);
        Document document = ownedDocument(folderId, documentId, user);

        return fileResponse(document, true);
    }

    // ===== CÁC METHOD PHỤ =====

    // Tìm người đang đăng nhập.
    private User currentUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Tài khoản không tồn tại"
                ));
    }

    // Tìm thư mục và kiểm tra quyền sở hữu.
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

    // Kiểm tra chung cho chi tiết, metadata, đổi tên,
    // di chuyển, xóa, xem và tải xuống.
    private Document ownedDocument(
            Long folderId,
            Long documentId,
            User user
    ) {
        ownedFolder(folderId, user);

        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Tài liệu không tồn tại"
                ));

        // Tài liệu đã xóa không được tiếp tục sử dụng.
        if (document.getDeletedAt() != null) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Tài liệu đã bị xóa"
            );
        }

        if (!document.getFolder().getId().equals(folderId)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Tài liệu không nằm trong thư mục này"
            );
        }

        if (!document.getOwner().getId().equals(user.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền thao tác với tài liệu này"
            );
        }

        return document;
    }

    // Kiểm tra tên mới, giữ nguyên phần mở rộng.
    private String validateRename(String input, String oldName) {
        if (input == null || input.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Tên file không được để trống"
            );
        }

        String name = input.trim();

        if (name.length() > 255
                || name.matches(".*[\\\\/:*?\"<>|].*")
                || name.chars().anyMatch(Character::isISOControl)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Tên file không hợp lệ hoặc dài quá 255 ký tự"
            );
        }

        String oldExtension = extension(oldName);
        String newExtension = extension(name);

        if (!oldExtension.equals(newExtension)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Đổi tên phải giữ nguyên đuôi ." + oldExtension
            );
        }

        return name;
    }

    // Đọc file và tạo phản hồi dùng chung cho xem/tải xuống.
    private ResponseEntity<byte[]> fileResponse(
            Document document,
            boolean download
    ) {
        Path filePath = uploadDir
                .resolve(document.getStoredName())
                .normalize();

        if (!filePath.startsWith(uploadDir)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Đường dẫn tài liệu không hợp lệ"
            );
        }

        if (!Files.isRegularFile(filePath)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Không tìm thấy file trên ổ đĩa"
            );
        }

        try {
            byte[] fileContent = Files.readAllBytes(filePath);

            ContentDisposition disposition = (
                    download
                            ? ContentDisposition.attachment()
                            : ContentDisposition.inline()
            )
                    .filename(
                            document.getOriginalName(),
                            StandardCharsets.UTF_8
                    )
                    .build();

            return ResponseEntity.ok()
                    .contentType(
                            MediaType.parseMediaType(document.getMimeType())
                    )
                    .header(
                            HttpHeaders.CONTENT_DISPOSITION,
                            disposition.toString()
                    )
                    .header(HttpHeaders.CACHE_CONTROL, "no-store")
                    .header("X-Content-Type-Options", "nosniff")
                    .body(fileContent);

        } catch (IOException exception) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Không thể đọc nội dung tài liệu",
                    exception
            );
        }
    }

    // Kiểm tra file rỗng và dung lượng.
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

    // Lấy tên file upload, bỏ đường dẫn nếu có.
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

        if (name.isBlank()
                || name.length() > 255
                || name.chars().anyMatch(Character::isISOControl)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Tên file không hợp lệ hoặc dài quá 255 ký tự"
            );
        }

        return name;
    }

    // Lấy và kiểm tra phần mở rộng.
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

    // Chuyển entity thành DTO trả về frontend.
    private DocumentResponse toResponse(Document document) {
        return new DocumentResponse(
                document.getId(),
                document.getOriginalName(),
                document.getMimeType(),
                document.getSize(),
                document.getFolder().getId(),
                document.getUploadedAt(),
                document.getTitle(),
                document.getDocumentNumber(),
                document.getDocumentType(),
                document.getIssuedDate(),
                document.getIssuer(),
                document.getKeywords(),
                document.getDescription()
        );
    }

    // Gán metadata, dùng chung cho upload và sửa metadata.
    private void applyMetadata(
            Document document,
            DocumentMetadataRequest request
    ) {
        document.setTitle(request.getTitle());
        document.setDocumentNumber(request.getDocumentNumber());
        document.setDocumentType(request.getDocumentType());
        document.setIssuedDate(request.getIssuedDate());
        document.setIssuer(request.getIssuer());
        document.setKeywords(request.getKeywords());
        document.setDescription(request.getDescription());
    }

    // Dọn file nếu upload thất bại.
    private void removeFailedUpload(
            Path path,
            Exception originalError
    ) {
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