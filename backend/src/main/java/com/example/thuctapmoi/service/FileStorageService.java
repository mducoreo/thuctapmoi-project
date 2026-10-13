package com.example.thuctapmoi.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

@Service
public class FileStorageService {

    private final Path uploadDir;

    public FileStorageService(
            @Value("${app.storage.upload-dir}") String uploadDir
    ) {
        this.uploadDir = Path.of(uploadDir)
                .toAbsolutePath()
                .normalize();
    }

    // Lưu file; nếu ghi thất bại thì dọn file vừa tạo.
    public Path save(
            Long folderId,
            byte[] content,
            String extension
    ) throws IOException {
        Path folderPath = uploadDir.resolve("folder-" + folderId);
        Files.createDirectories(folderPath);

        Path savedPath = Files.createTempFile(
                folderPath,
                "document-",
                "." + extension
        );

        try {
            Files.write(savedPath, content);
            return savedPath;

        } catch (IOException | RuntimeException exception) {
            removeFailedUpload(savedPath, exception);
            throw exception;
        }
    }

    // Lấy đường dẫn tương đối để lưu trong database.
    public String storedName(Path savedPath) {
        return uploadDir.relativize(savedPath)
                .toString()
                .replace('\\', '/');
    }

    // Đường dẫn lưu trong database phải nằm trong thư mục upload.
    private Path resolve(String storedName) {
        Path filePath = uploadDir.resolve(storedName).normalize();

        if (!filePath.startsWith(uploadDir)
                || filePath.equals(uploadDir)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Đường dẫn tài liệu không hợp lệ"
            );
        }

        return filePath;
    }

    // Đọc nội dung file trên ổ đĩa.
    public byte[] read(String storedName) {
        Path filePath = resolve(storedName);

        if (!Files.isRegularFile(filePath)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Không tìm thấy file trên ổ đĩa"
            );
        }

        try {
            return Files.readAllBytes(filePath);

        } catch (IOException exception) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Không thể đọc nội dung tài liệu",
                    exception
            );
        }
    }

    // Giữ hai đường dẫn để xử lý commit/rollback.
    public record PendingDelete(
            Path originalPath,
            Path temporaryPath
    ) {}

    // Tạm đổi tên file trước khi xóa bản ghi database.
    public PendingDelete prepareDelete(String storedName) {
        Path filePath = resolve(storedName);

        if (!Files.exists(filePath)) {
            return null;
        }

        try {
            Path realFile = filePath.toRealPath();

            if (!realFile.startsWith(uploadDir.toRealPath())
                    || !Files.isRegularFile(realFile)) {
                throw new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "Đường dẫn tài liệu không hợp lệ"
                );
            }

            Path pendingDelete = filePath.resolveSibling(
                    ".delete-" + UUID.randomUUID()
            );

            Files.move(filePath, pendingDelete);

            return new PendingDelete(filePath, pendingDelete);

        } catch (IOException exception) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Không thể xử lý file cần xóa",
                    exception
            );
        }
    }

    // Database commit thành công: xóa file đã tạm đổi tên.
    public void finishDelete(PendingDelete pending) {
        try {
            Files.deleteIfExists(pending.temporaryPath());

        } catch (IOException exception) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Đã xóa bản ghi nhưng chưa dọn được file trên ổ đĩa",
                    exception
            );
        }
    }

    // Database rollback: trả file về đường dẫn ban đầu.
    public void restoreDelete(
            PendingDelete pending
    ) throws IOException {
        Files.move(
                pending.temporaryPath(),
                pending.originalPath()
        );
    }

    // Dọn file nếu upload thất bại.
    public void removeFailedUpload(
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