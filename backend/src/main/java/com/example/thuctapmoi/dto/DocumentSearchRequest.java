package com.example.thuctapmoi.dto;

import lombok.Getter;
import lombok.Setter;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;

@Getter
@Setter
public class DocumentSearchRequest {

    // Tìm theo tên file, tiêu đề và metadata.
    private String keyword;

    // Tìm trong nội dung OCR.
    private String ocrKeyword;

    // Lọc theo thư mục.
    private Long folderId;

    // Lọc theo số hiệu.
    private String documentNumber;

    // Lọc theo loại văn bản.
    private String documentType;

    // Lọc theo đơn vị ban hành.
    private String issuer;

    // Lọc theo khoảng ngày ban hành.
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate issuedDateFrom;

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate issuedDateTo;

    // Trang đầu tiên là 0.
    private int page = 0;

    // Số tài liệu mỗi trang.
    private int size = 10;
}