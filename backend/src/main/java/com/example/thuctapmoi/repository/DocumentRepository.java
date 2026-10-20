package com.example.thuctapmoi.repository;

import com.example.thuctapmoi.entity.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
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

    // Tìm theo tên, metadata, bộ lọc và phân trang.
    @Query("""
            SELECT d
            FROM Document d
            WHERE d.deletedAt IS NULL

              AND (
                  :isAdmin = true
                  OR d.owner.username = :username
              )

              AND (
                  :keyword IS NULL
                  OR LOWER(d.originalName)
                      LIKE LOWER(CONCAT('%', :keyword, '%'))
                  OR LOWER(d.title)
                      LIKE LOWER(CONCAT('%', :keyword, '%'))
                  OR LOWER(d.documentNumber)
                      LIKE LOWER(CONCAT('%', :keyword, '%'))
                  OR LOWER(d.documentType)
                      LIKE LOWER(CONCAT('%', :keyword, '%'))
                  OR LOWER(d.issuer)
                      LIKE LOWER(CONCAT('%', :keyword, '%'))
                  OR LOWER(d.keywords)
                      LIKE LOWER(CONCAT('%', :keyword, '%'))
              )

              AND (
                  :folderId IS NULL
                  OR d.folder.id = :folderId
              )

              AND (
                  :documentNumber IS NULL
                  OR LOWER(d.documentNumber)
                      LIKE LOWER(CONCAT('%', :documentNumber, '%'))
              )

              AND (
                  :documentType IS NULL
                  OR d.documentType = :documentType
              )

              AND (
                  :issuer IS NULL
                  OR LOWER(d.issuer)
                      LIKE LOWER(CONCAT('%', :issuer, '%'))
              )

              AND (
                  :issuedDateFrom IS NULL
                  OR d.issuedDate >= :issuedDateFrom
              )

              AND (
                  :issuedDateTo IS NULL
                  OR d.issuedDate <= :issuedDateTo
              )
            """)
    Page<Document> search(
            @Param("keyword") String keyword,
            @Param("folderId") Long folderId,
            @Param("documentNumber") String documentNumber,
            @Param("documentType") String documentType,
            @Param("issuer") String issuer,
            @Param("issuedDateFrom") LocalDate issuedDateFrom,
            @Param("issuedDateTo") LocalDate issuedDateTo,
            @Param("username") String username,
            @Param("isAdmin") boolean isAdmin,
            Pageable pageable
    );

    // Điều kiện dùng chung cho truy vấn OCR và đếm kết quả phân trang.
    String OCR_SEARCH_FILTERS = """
            FROM dbo.documents d
            JOIN dbo.users u ON u.id = d.owner_id
            WHERE d.deleted_at IS NULL

              AND (
                  :isAdmin = 1
                  OR u.username = :username
              )

              AND CONTAINS(d.extracted_text, :ocrKeyword)

              AND (
                  :keyword IS NULL
                  OR LOWER(d.original_name)
                      LIKE LOWER(CONCAT('%', :keyword, '%'))
                  OR LOWER(d.title)
                      LIKE LOWER(CONCAT('%', :keyword, '%'))
                  OR LOWER(d.document_number)
                      LIKE LOWER(CONCAT('%', :keyword, '%'))
                  OR LOWER(d.document_type)
                      LIKE LOWER(CONCAT('%', :keyword, '%'))
                  OR LOWER(d.issuer)
                      LIKE LOWER(CONCAT('%', :keyword, '%'))
                  OR LOWER(d.keywords)
                      LIKE LOWER(CONCAT('%', :keyword, '%'))
              )

              AND (
                  :folderId IS NULL
                  OR d.folder_id = :folderId
              )

              AND (
                  :documentNumber IS NULL
                  OR LOWER(d.document_number)
                      LIKE LOWER(CONCAT('%', :documentNumber, '%'))
              )

              AND (
                  :documentType IS NULL
                  OR d.document_type = :documentType
              )

              AND (
                  :issuer IS NULL
                  OR LOWER(d.issuer)
                      LIKE LOWER(CONCAT('%', :issuer, '%'))
              )

              AND (
                  :issuedDateFrom IS NULL
                  OR d.issued_date >= :issuedDateFrom
              )

              AND (
                  :issuedDateTo IS NULL
                  OR d.issued_date <= :issuedDateTo
              )
            """;

    // Full-Text Search OCR kết hợp tên, metadata, bộ lọc và phân trang.
    @Query(
            value = "SELECT d.* " + OCR_SEARCH_FILTERS
                    + " ORDER BY d.uploaded_at DESC, d.id DESC",
            countQuery = "SELECT COUNT(*) " + OCR_SEARCH_FILTERS,
            nativeQuery = true
    )
    Page<Document> searchWithOcr(
            @Param("ocrKeyword") String ocrKeyword,
            @Param("keyword") String keyword,
            @Param("folderId") Long folderId,
            @Param("documentNumber") String documentNumber,
            @Param("documentType") String documentType,
            @Param("issuer") String issuer,
            @Param("issuedDateFrom") LocalDate issuedDateFrom,
            @Param("issuedDateTo") LocalDate issuedDateTo,
            @Param("username") String username,
            @Param("isAdmin") boolean isAdmin,
            Pageable pageable
    );
}