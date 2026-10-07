package com.example.thuctapmoi.controller;

import com.example.thuctapmoi.dto.FolderRequest;
import com.example.thuctapmoi.dto.FolderResponse;
import com.example.thuctapmoi.service.FolderService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/folders")
public class FolderController {

    private final FolderService service;

    public FolderController(FolderService service) {
        this.service = service;
    }

    @GetMapping
    public List<FolderResponse> list(
            @RequestParam(required = false) Long parentId,
            Authentication auth
    ) {
        return service.list(parentId, auth.getName());
    }

    @GetMapping("/{id}")
    public FolderResponse get(
            @PathVariable Long id,
            Authentication auth
    ) {
        return service.get(id, auth.getName());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FolderResponse create(
            @Valid @RequestBody FolderRequest request,
            Authentication auth
    ) {
        return service.create(request, auth.getName());
    }

    @PutMapping("/{id}")
    public FolderResponse update(
            @PathVariable Long id,
            @Valid @RequestBody FolderRequest request,
            Authentication auth
    ) {
        return service.update(id, request, auth.getName());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable Long id,
            Authentication auth
    ) {
        service.delete(id, auth.getName());
    }
}