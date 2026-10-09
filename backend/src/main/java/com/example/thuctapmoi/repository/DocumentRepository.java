package com.example.thuctapmoi.repository;

import com.example.thuctapmoi.entity.Document;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentRepository extends JpaRepository<Document, Long> {

    List<Document> findByFolder_IdOrderByUploadedAtDesc(Long folderId);
}