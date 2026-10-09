package com.example.thuctapmoi.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Nationalized;

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

    // Tên file người dùng upload, ví dụ: Báo cáo.pdf
    @Nationalized
    @Column(nullable = false, length = 255)
    private String originalName;

    // Tên dùng để lưu file trên ổ đĩa, tránh trùng tên
    @Column(nullable = false, unique = true, length = 100)
    private String storedName;

    // Loại nội dung, ví dụ: application/pdf
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

    public Document() {
    }
}