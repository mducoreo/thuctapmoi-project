package com.example.thuctapmoi.dto;

import jakarta.validation.constraints.Positive;

public class MoveFolderRequest {

    @Positive(message = "ID thư mục cha phải lớn hơn 0")
    private Long parentId;

    public Long getParentId() {
        return parentId;
    }

    public void setParentId(Long parentId) {
        this.parentId = parentId;
    }
}