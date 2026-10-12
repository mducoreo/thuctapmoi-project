package com.example.thuctapmoi.repository;

import com.example.thuctapmoi.entity.Document;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentRepository extends JpaRepository<Document, Long> {

    // Chỉ lấy tài liệu chưa bị xóa.
    List<Document> findByFolder_IdAndDeletedAtIsNullOrderByUploadedAtDesc(
            Long folderId
    );

    // Giữ lại để các chỗ đang gọi method cũ không bị lỗi.
    default List<Document> findByFolder_IdOrderByUploadedAtDesc(
            Long folderId
    ) {
        return findByFolder_IdAndDeletedAtIsNullOrderByUploadedAtDesc(
                folderId
        );
    }
}