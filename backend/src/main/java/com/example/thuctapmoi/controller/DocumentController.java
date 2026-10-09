package com.example.thuctapmoi.controller;

import com.example.thuctapmoi.dto.DocumentResponse;
import com.example.thuctapmoi.service.DocumentService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/folders/{folderId}/documents")
public class DocumentController {

    private final DocumentService service;

    public DocumentController(DocumentService service) {
        this.service = service;
    }

    // Upload tài liệu vào thư mục
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public DocumentResponse upload(
            @PathVariable("folderId") Long folderId,
            @RequestParam("file") MultipartFile file,
            Authentication authentication
    ) {
        return service.upload(
                folderId,
                file,
                authentication.getName()
        );
    }

    // Lấy danh sách tài liệu trong thư mục
    @GetMapping
    public List<DocumentResponse> list(
            @PathVariable("folderId") Long folderId,
            Authentication authentication
    ) {
        return service.list(
                folderId,
                authentication.getName()
        );
    }
}