package com.example.thuctapmoi.controller;

import com.example.thuctapmoi.dto.DocumentPageResponse;
import com.example.thuctapmoi.dto.DocumentSearchRequest;
import com.example.thuctapmoi.service.DocumentService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/documents")
public class DocumentSearchController {

    private final DocumentService service;

    public DocumentSearchController(DocumentService service) {
        this.service = service;
    }

    // Tìm tên, metadata, nội dung OCR, lọc và phân trang.
    @GetMapping("/search")
    public DocumentPageResponse search(
            @Valid @ModelAttribute DocumentSearchRequest request,
            Authentication authentication
    ) {
        return service.search(
                request,
                authentication.getName()
        );
    }
}