package com.example.thuctapmoi.service;
import com.example.thuctapmoi.entity.AuditAction;
import com.example.thuctapmoi.dto.DocumentMetadataRequest;
import com.example.thuctapmoi.dto.DocumentMoveRequest;
import com.example.thuctapmoi.dto.DocumentPageResponse;
import com.example.thuctapmoi.dto.DocumentRenameRequest;
import com.example.thuctapmoi.dto.DocumentResponse;
import com.example.thuctapmoi.dto.DocumentSearchRequest;
import com.example.thuctapmoi.dto.DocumentTextRequest;
import com.example.thuctapmoi.entity.Document;
import com.example.thuctapmoi.entity.Folder;
import com.example.thuctapmoi.entity.OcrStatus;
import com.example.thuctapmoi.entity.User;
import com.example.thuctapmoi.entity.UserRole;
import com.example.thuctapmoi.repository.DocumentRepository;
import com.example.thuctapmoi.repository.FolderRepository;
import com.example.thuctapmoi.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
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
    private final OcrService ocrService;
    private final DocumentOcrStatusService ocrStatusService;
    private final AuditLogService auditLogService;

    public DocumentService(
            DocumentRepository documentRepository,
            FolderRepository folderRepository,
            UserRepository userRepository,
            FileStorageService fileStorageService,
            DocumentFileValidator fileValidator,
            OcrService ocrService,
            DocumentOcrStatusService ocrStatusService,
            AuditLogService auditLogService
    ) {
        this.documentRepository = documentRepository;
        this.folderRepository = folderRepository;
        this.userRepository = userRepository;
        this.fileStorageService = fileStorageService;
        this.fileValidator = fileValidator;
        this.ocrService = ocrService;
        this.ocrStatusService = ocrStatusService;
        this.auditLogService = auditLogService;
    }

    // ===== CÁC METHOD CHÍNH =====

    // 1. Upload file kèm metadata.
    @Transactional
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

            // ADMIN upload vào thư mục của ai thì tài liệu thuộc người đó.
            document.setOwner(folder.getOwner());

            document.setUploadedAt(LocalDateTime.now());
            document.setOcrStatus(OcrStatus.PENDING);
            document.setOcrError(null);

            applyMetadata(document, request);

            Document saved = documentRepository.saveAndFlush(document);
            auditLogService.log(
                    user,
                    saved,
                    AuditAction.UPLOAD );
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

    // 3. Lấy chi tiết tài liệu.
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

    // 6. Chuyển tài liệu sang thư mục khác cùng chủ sở hữu.
    @Transactional
    public DocumentResponse move(
            Long folderId,
            Long documentId,
            DocumentMoveRequest request,
            String username
    ) {
        User user = currentUser(username);
        Document document = ownedDocument(folderId, documentId, user);

        Folder targetFolder = ownedFolder(
                request.getTargetFolderId(),
                user
        );

        // Giữ tài liệu trong cây thư mục của cùng chủ sở hữu.
        if (!document.getOwner().getId().equals(
                targetFolder.getOwner().getId()
        )) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Thư mục đích phải cùng chủ sở hữu với tài liệu"
            );
        }

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
        auditLogService.log(
                user,
                document,
                AuditAction.DELETE
        );
    }

    // 8. Xem nội dung file và ghi nhật ký.
    @Transactional
    public ResponseEntity<byte[]> content(
            Long folderId,
            Long documentId,
            String username
    ) {
        User user = currentUser(username);
        Document document = ownedDocument(folderId, documentId, user);

        ResponseEntity<byte[]> response = fileResponse(document, false);

        auditLogService.log(
                user,
                document,
                AuditAction.VIEW
        );

        return response;
    }

    // 9. Tải xuống file.
    // Tải xuống file và ghi nhật ký DOWNLOAD.
    @Transactional
    public ResponseEntity<byte[]> download(
            Long folderId,
            Long documentId,
            String username
    ) {
        User user = currentUser(username);
        Document document = ownedDocument(folderId, documentId, user);

        ResponseEntity<byte[]> response = fileResponse(document, true);

        auditLogService.log(
                user,
                document,
                AuditAction.DOWNLOAD
        );

        return response;
    }

    // Ghi nhận người dùng yêu cầu in tài liệu.
    @Transactional
    public void logPrint(
            Long folderId,
            Long documentId,
            String username
    ) {
        User user = currentUser(username);
        Document document = ownedDocument(folderId, documentId, user);

        auditLogService.log(
                user,
                document,
                AuditAction.PRINT
        );
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

        checkDocumentPermission(document, user);

        FileStorageService.PendingDelete pending =
                fileStorageService.prepareDelete(
                        document.getStoredName()
                );

        if (pending != null) {
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

        auditLogService.log(
                user,
                document,
                AuditAction.PERMANENT_DELETE );
    }

    // 11. Chạy OCR, lưu trạng thái, kết quả hoặc lỗi.
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public String runOcr(
            Long folderId,
            Long documentId,
            String username
    ) {
        User user = currentUser(username);
        Document document = ownedDocument(folderId, documentId, user);

        String storedName = document.getStoredName();
        String mimeType = document.getMimeType();

        // Đặt ngoài try để yêu cầu chạy trùng không làm đổi thành FAILED.
        ocrStatusService.start(documentId);

        String text;

        try {
            byte[] fileContent = fileStorageService.read(storedName);

            text = ocrService.extractText(fileContent, mimeType);

            if (text == null || text.isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.UNPROCESSABLE_ENTITY,
                        "Không nhận diện được chữ trong tài liệu"
                );
            }

        } catch (Exception exception) {
            String errorMessage = "Không thể xử lý OCR cho tài liệu";

            if (exception instanceof ResponseStatusException responseException) {
                String reason = responseException.getReason();

                if (reason != null && !reason.isBlank()) {
                    errorMessage = reason;
                }
            }

            org.slf4j.LoggerFactory
                    .getLogger(DocumentService.class)
                    .error(
                            "OCR thất bại cho tài liệu {}",
                            documentId,
                            exception
                    );

            ocrStatusService.fail(documentId, errorMessage);

            if (exception instanceof ResponseStatusException responseException) {
                throw responseException;
            }

            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    errorMessage,
                    exception
            );
        }

        ocrStatusService.complete(documentId, text);

        auditLogService.log(
                user,
                document,
                AuditAction.OCR );

        return text;
    }

    // 12. Lấy nội dung chữ đã lưu, không chạy lại OCR.
    @Transactional(readOnly = true)
    public String getExtractedText(
            Long folderId,
            Long documentId,
            String username
    ) {
        User user = currentUser(username);
        Document document = ownedDocument(folderId, documentId, user);

        String text = document.getExtractedText();

        return text == null ? "" : text;
    }

    // 13. Lưu lại nội dung OCR sau khi người dùng chỉnh sửa.
    @Transactional
    public String updateExtractedText(
            Long folderId,
            Long documentId,
            DocumentTextRequest request,
            String username
    ) {
        User user = currentUser(username);

        Document document = ownedDocument(
                folderId,
                documentId,
                user
        );

        document.setExtractedText(request.getExtractedText());

        documentRepository.saveAndFlush(document);

        return document.getExtractedText();
    }

    // 14. Tìm tên, metadata, nội dung OCR, lọc và phân trang.
    @Transactional(readOnly = true)
    public DocumentPageResponse search(
            DocumentSearchRequest request,
            String username
    ) {
        User user = currentUser(username);

        // Kiểm tra thông tin phân trang.
        if (request.getPage() < 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Số trang không được nhỏ hơn 0"
            );
        }

        if (request.getSize() < 1 || request.getSize() > 100) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Số tài liệu mỗi trang phải từ 1 đến 100"
            );
        }

        // Kiểm tra khoảng ngày ban hành.
        if (request.getIssuedDateFrom() != null
                && request.getIssuedDateTo() != null
                && request.getIssuedDateFrom().isAfter(
                request.getIssuedDateTo()
        )) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Ngày bắt đầu không được sau ngày kết thúc"
            );
        }

        // Nếu chọn thư mục thì kiểm tra quyền truy cập.
        if (request.getFolderId() != null) {
            ownedFolder(request.getFolderId(), user);
        }

        String keyword = normalizeSearchValue(
                request.getKeyword()
        );
        String documentNumber = normalizeSearchValue(
                request.getDocumentNumber()
        );
        String documentType = normalizeSearchValue(
                request.getDocumentType()
        );
        String issuer = normalizeSearchValue(
                request.getIssuer()
        );
        String ocrKeyword = normalizeSearchValue(
                request.getOcrKeyword()
        );

        Page<Document> result;

        if (ocrKeyword == null) {
            // Không nhập từ khóa OCR: dùng query tìm kiếm thông thường.
            Pageable pageable = PageRequest.of(
                    request.getPage(),
                    request.getSize(),
                    Sort.by(
                            Sort.Order.desc("uploadedAt"),
                            Sort.Order.desc("id")
                    )
            );

            result = documentRepository.search(
                    keyword,
                    request.getFolderId(),
                    documentNumber,
                    documentType,
                    issuer,
                    request.getIssuedDateFrom(),
                    request.getIssuedDateTo(),
                    user.getUsername(),
                    isAdmin(user),
                    pageable
            );
        } else {
            // Biến nội dung nhập thành một cụm từ cho CONTAINS.
            String phrase = ocrKeyword
                    .replace("\"", " ")
                    .replaceAll("\\s+", " ")
                    .strip();

            if (phrase.isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Từ khóa OCR không hợp lệ"
                );
            }

            String ocrCondition = "\"" + phrase + "\"";

            // Query SQL đã có ORDER BY nên chỉ truyền thông tin trang.
            Pageable pageable = PageRequest.of(
                    request.getPage(),
                    request.getSize()
            );

            result = documentRepository.searchWithOcr(
                    ocrCondition,
                    keyword,
                    request.getFolderId(),
                    documentNumber,
                    documentType,
                    issuer,
                    request.getIssuedDateFrom(),
                    request.getIssuedDateTo(),
                    user.getUsername(),
                    isAdmin(user),
                    pageable
            );
        }

        // Chuyển từng Document thành DocumentResponse.
        List<DocumentResponse> items = result.getContent()
                .stream()
                .map(this::toResponse)
                .toList();

        return new DocumentPageResponse(
                items,
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages()
        );
    }

    // ===== CÁC METHOD PHỤ =====

    // Bỏ khoảng trắng thừa ở hai đầu.
    // Không nhập nội dung thì trả null để query bỏ qua điều kiện.
    private String normalizeSearchValue(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        return value.strip();
    }

    // Tìm người đang đăng nhập và kiểm tra trạng thái tài khoản.
    private User currentUser(String username) {
        User user = userRepository.findByUsername(username)
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

        return user;
    }

    // Kiểm tra quyền ADMIN.
    private boolean isAdmin(User user) {
        return user.getRole() == UserRole.ADMIN;
    }

    // ADMIN hoặc chủ sở hữu được truy cập thư mục.
    private Folder ownedFolder(Long folderId, User user) {
        Folder folder = folderRepository.findById(folderId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Thư mục không tồn tại"
                ));

        boolean isOwner = folder.getOwner().getId().equals(user.getId());

        if (!isAdmin(user) && !isOwner) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền truy cập thư mục này"
            );
        }

        return folder;
    }

    // ADMIN hoặc chủ sở hữu được thao tác với tài liệu.
    private void checkDocumentPermission(Document document, User user) {
        boolean isOwner = document.getOwner().getId().equals(user.getId());

        if (!isAdmin(user) && !isOwner) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền thao tác với tài liệu này"
            );
        }
    }

    // Kiểm tra chung cho chi tiết, metadata, đổi tên,
    // di chuyển, xóa mềm, xem, tải xuống và OCR.
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

        checkDocumentPermission(document, user);

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
                document.getDescription(),
                document.getOcrStatus(),
                document.getOcrError()
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