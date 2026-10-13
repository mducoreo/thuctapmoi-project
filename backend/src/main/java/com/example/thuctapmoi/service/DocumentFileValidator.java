package com.example.thuctapmoi.service;

import org.apache.tika.Tika;
import org.apache.tika.io.TikaInputStream;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Locale;
import java.util.Map;

@Component
public class DocumentFileValidator {

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

    private final Tika tika = new Tika();

    // Kiểm tra tên mới, giữ nguyên phần mở rộng.
    public String validateRename(String input, String oldName) {
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

    // Kiểm tra file rỗng và dung lượng.
    public void validateSize(MultipartFile file) {
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
    public String originalName(MultipartFile file) {
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
    public String extension(String name) {
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

    // Đọc loại nội dung thật và đối chiếu với đuôi file.
    public String validateContent(
            byte[] content,
            String extension
    ) throws IOException {
        String mimeType;

        try (TikaInputStream input = TikaInputStream.get(content)) {
            mimeType = tika.detect(input);
        }

        if (!ALLOWED_TYPES.get(extension).equals(mimeType)) {
            throw new ResponseStatusException(
                    HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "Nội dung file không phù hợp với định dạng đã chọn"
            );
        }

        return mimeType;
    }
}