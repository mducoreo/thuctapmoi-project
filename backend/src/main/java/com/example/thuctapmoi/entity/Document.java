package com.example.thuctapmoi.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Nationalized;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "documents")
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    // Tên file người dùng upload, ví dụ: BaoCao.pdf
    @Nationalized
    @Column(nullable = false, length = 255)
    private String originalName;

    // Tên dùng để lưu file trên ổ đĩa, tránh trùng tên
    @Column(nullable = false, unique = true, length = 100)
    private String storedName;

    // Loại nội dung file, ví dụ: application/pdf
    @Column(nullable = false, length = 150)
    private String mimeType;

    // Dung lượng file, đơn vị byte
    @Column(nullable = false)
    private Long size;

    // Thư mục chứa tài liệu
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "folder_id", nullable = false)
    private Folder folder;

    // Người upload tài liệu
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(nullable = false)
    private LocalDateTime uploadedAt;

    // Tên văn bản
    @Nationalized
    @Column(length = 255)
    private String title;

    // Số hiệu văn bản
    @Nationalized
    @Column(length = 100)
    private String documentNumber;

    // Loại văn bản: Công văn, Quyết định, Thông báo...
    @Nationalized
    @Column(length = 100)
    private String documentType;

    // Ngày ban hành
    private LocalDate issuedDate;

    // Đơn vị hoặc người ban hành
    @Nationalized
    @Column(length = 255)
    private String issuer;

    // Từ khóa
    @Nationalized
    @Column(length = 500)
    private String keywords;

    // Mô tả
    @Nationalized
    @Column(length = 2000)
    private String description;

    // Nội dung chữ lấy được từ tài liệu bằng OCR
    @Nationalized
    @Column(name = "extracted_text", columnDefinition = "nvarchar(max)")
    private String extractedText;

    // Có giá trị nghĩa là tài liệu đã bị xóa mềm
    private LocalDateTime deletedAt;

    public Document() {
    }
}