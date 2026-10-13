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
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final FolderRepository folderRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;
    private final DocumentFileValidator fileValidator;

    public DocumentService(
            DocumentRepository documentRepository,
            FolderRepository folderRepository,
            UserRepository userRepository,
            FileStorageService fileStorageService,
            DocumentFileValidator fileValidator
    ) {
        this.documentRepository = documentRepository;
        this.folderRepository = folderRepository;
        this.userRepository = userRepository;
        this.fileStorageService = fileStorageService;
        this.fileValidator = fileValidator;
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

        fileValidator.validateSize(file);

        String originalName = fileValidator.originalName(file);
        String extension = fileValidator.extension(originalName);
        Path savedPath = null;

        try {
            byte[] content = file.getBytes();

            String mimeType = fileValidator.validateContent(
                    content,
                    extension
            );

            savedPath = fileStorageService.save(
                    folderId,
                    content,
                    extension
            );

            Document document = new Document();
            document.setOriginalName(originalName);
            document.setStoredName(
                    fileStorageService.storedName(savedPath)
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
            fileStorageService.removeFailedUpload(
                    savedPath,
                    exception
            );

            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Không thể đọc hoặc lưu file",
                    exception
            );

        } catch (RuntimeException exception) {
            fileStorageService.removeFailedUpload(
                    savedPath,
                    exception
            );
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

        String name = fileValidator.validateRename(
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

    // 10. Xóa vĩnh viễn bản ghi và file trên ổ đĩa.
    @Transactional
    public void permanentDelete(
            Long folderId,
            Long documentId,
            String username
    ) {
        User user = currentUser(username);
        ownedFolder(folderId, user);

        // Không dùng ownedDocument vì hàm đó chặn tài liệu đã xóa mềm.
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Tài liệu không tồn tại"
                ));

        if (!document.getFolder().getId().equals(folderId)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Tài liệu không nằm trong thư mục này"
            );
        }

        if (!document.getOwner().getId().equals(user.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền xóa tài liệu này"
            );
        }

        FileStorageService.PendingDelete pending =
                fileStorageService.prepareDelete(
                        document.getStoredName()
                );

        if (pending != null) {
            // Storage xử lý file; DocumentService quản lý transaction.
            TransactionSynchronizationManager.registerSynchronization(
                    new TransactionSynchronization() {

                        @Override
                        public void afterCommit() {
                            // Database đã xóa thành công: xóa file thật.
                            fileStorageService.finishDelete(pending);
                        }

                        @Override
                        public void afterCompletion(int status) {
                            // Database rollback: trả file về tên ban đầu.
                            if (status == STATUS_ROLLED_BACK) {
                                try {
                                    fileStorageService.restoreDelete(pending);
                                } catch (IOException exception) {
                                    org.slf4j.LoggerFactory
                                            .getLogger(DocumentService.class)
                                            .error(
                                                    "Không thể khôi phục file sau rollback: {}",
                                                    pending.originalPath(),
                                                    exception
                                            );
                                }
                            }
                        }
                    }
            );
        }

        // File đã mất thì vẫn cho phép dọn bản ghi trong database.
        documentRepository.delete(document);
        documentRepository.flush();
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

    // Tạo phản hồi dùng chung cho xem/tải xuống.
    private ResponseEntity<byte[]> fileResponse(
            Document document,
            boolean download
    ) {
        byte[] fileContent = fileStorageService.read(
                document.getStoredName()
        );

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
}