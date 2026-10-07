package com.example.thuctapmoi.repository;

import com.example.thuctapmoi.entity.Folder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FolderRepository extends JpaRepository<Folder, Long> {

    List<Folder> findByOwnerIdAndParentIsNull(Long ownerId);

    List<Folder> findByParentId(Long parentId);
    List<Folder> findByParentIsNull();

    boolean existsByParentId(Long parentId);
}