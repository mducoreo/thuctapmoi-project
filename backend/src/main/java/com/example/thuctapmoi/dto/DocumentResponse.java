package com.example.thuctapmoi.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class DocumentResponse {

    private Long id;

    private String originalName;

    private String mimeType;

    private Long size;

    private Long folderId;

    private LocalDateTime uploadedAt;

    // Metadata văn bản
    private String title;

    private String documentNumber;

    private String documentType;

    private LocalDate issuedDate;

    private String issuer;

    private String keywords;

    private String description;
}