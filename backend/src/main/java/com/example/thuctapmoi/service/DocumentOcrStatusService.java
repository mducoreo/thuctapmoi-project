package com.example.thuctapmoi.service;

import com.example.thuctapmoi.entity.Document;
import com.example.thuctapmoi.entity.OcrStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DocumentOcrStatusService {

    private final EntityManager entityManager;

    public DocumentOcrStatusService(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    // Lưu PROCESSING trước khi bắt đầu đọc file và chạy OCR.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void start(Long documentId) {
        Document document = lockedDocument(documentId);

        if (document.getOcrStatus() == OcrStatus.PROCESSING) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Tài liệu đang được xử lý OCR"
            );
        }

        document.setOcrStatus(OcrStatus.PROCESSING);
        document.setOcrError(null);
    }

    // Lưu kết quả và COMPLETED trong cùng một transaction.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void complete(Long documentId, String text) {
        Document document = lockedDocument(documentId);

        document.setExtractedText(text);
        document.setOcrStatus(OcrStatus.COMPLETED);
        document.setOcrError(null);
    }

    // Lưu lỗi độc lập trước khi API trả thông báo lỗi.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(Long documentId, String error) {
        Document document = lockedDocument(documentId);

        document.setOcrStatus(OcrStatus.FAILED);
        document.setOcrError(error);
    }

    // Đọc dữ liệu mới nhất và khóa bản ghi trong lúc cập nhật.
    private Document lockedDocument(Long documentId) {
        Document document = entityManager.find(
                Document.class,
                documentId
        );

        if (document == null) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Tài liệu không tồn tại"
            );
        }

        entityManager.refresh(
                document,
                LockModeType.PESSIMISTIC_WRITE
        );

        if (document.getDeletedAt() != null) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Tài liệu đã bị xóa"
            );
        }

        return document;
    }
}