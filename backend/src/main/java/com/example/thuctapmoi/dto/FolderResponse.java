package com.example.thuctapmoi.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class FolderResponse {

    private Long id;
    private String name;
    private Long parentId;
    private Long ownerId;
    private String ownerUsername;
}