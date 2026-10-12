package com.example.thuctapmoi.controller;

import com.example.thuctapmoi.dto.DocumentMetadataRequest;
import com.example.thuctapmoi.dto.DocumentMoveRequest;
import com.example.thuctapmoi.dto.DocumentRenameRequest;
import com.example.thuctapmoi.dto.DocumentResponse;
import com.example.thuctapmoi.service.DocumentService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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

    // Upload file kèm metadata.
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public DocumentResponse upload(
            @PathVariable("folderId") Long folderId,
            @RequestParam("file") MultipartFile file,
            @Valid @ModelAttribute DocumentMetadataRequest request,
            Authentication authentication
    ) {
        return service.upload(
                folderId,
                file,
                request,
                authentication.getName()
        );
    }

    // Danh sách tài liệu chưa bị xóa.
    @GetMapping
    public List<DocumentResponse> list(
            @PathVariable("folderId") Long folderId,
            Authentication authentication
    ) {
        return service.list(folderId, authentication.getName());
    }

    // Chi tiết một tài liệu.
    @GetMapping("/{documentId}")
    public DocumentResponse detail(
            @PathVariable("folderId") Long folderId,
            @PathVariable("documentId") Long documentId,
            Authentication authentication
    ) {
        return service.detail(
                folderId,
                documentId,
                authentication.getName()
        );
    }

    // Sửa metadata.
    @PutMapping(
            value = "/{documentId}/metadata",
            consumes = MediaType.APPLICATION_JSON_VALUE
    )
    public DocumentResponse updateMetadata(
            @PathVariable("folderId") Long folderId,
            @PathVariable("documentId") Long documentId,
            @Valid @RequestBody DocumentMetadataRequest request,
            Authentication authentication
    ) {
        return service.updateMetadata(
                folderId,
                documentId,
                request,
                authentication.getName()
        );
    }

    // Đổi tên file hiển thị.
    @PatchMapping(
            value = "/{documentId}/rename",
            consumes = MediaType.APPLICATION_JSON_VALUE
    )
    public DocumentResponse rename(
            @PathVariable("folderId") Long folderId,
            @PathVariable("documentId") Long documentId,
            @Valid @RequestBody DocumentRenameRequest request,
            Authentication authentication
    ) {
        return service.rename(
                folderId,
                documentId,
                request,
                authentication.getName()
        );
    }

    // Chuyển tài liệu sang thư mục khác.
    @PatchMapping(
            value = "/{documentId}/move",
            consumes = MediaType.APPLICATION_JSON_VALUE
    )
    public DocumentResponse move(
            @PathVariable("folderId") Long folderId,
            @PathVariable("documentId") Long documentId,
            @Valid @RequestBody DocumentMoveRequest request,
            Authentication authentication
    ) {
        return service.move(
                folderId,
                documentId,
                request,
                authentication.getName()
        );
    }

    // Xóa mềm.
    @DeleteMapping("/{documentId}")
    public ResponseEntity<Void> delete(
            @PathVariable("folderId") Long folderId,
            @PathVariable("documentId") Long documentId,
            Authentication authentication
    ) {
        service.delete(
                folderId,
                documentId,
                authentication.getName()
        );

        return ResponseEntity.noContent().build();
    }

    // Xem nội dung: giữ API cũ.
    @GetMapping("/{documentId}/content")
    public ResponseEntity<byte[]> content(
            @PathVariable("folderId") Long folderId,
            @PathVariable("documentId") Long documentId,
            Authentication authentication
    ) {
        return service.content(
                folderId,
                documentId,
                authentication.getName()
        );
    }

    // Tải file xuống.
    @GetMapping("/{documentId}/download")
    public ResponseEntity<byte[]> download(
            @PathVariable("folderId") Long folderId,
            @PathVariable("documentId") Long documentId,
            Authentication authentication
    ) {
        return service.download(
                folderId,
                documentId,
                authentication.getName()
        );
    }
}