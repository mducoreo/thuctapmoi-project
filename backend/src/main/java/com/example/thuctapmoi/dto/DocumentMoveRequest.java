package com.example.thuctapmoi.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DocumentMoveRequest {

    @NotNull(message = "Vui lòng chọn thư mục đích")
    @Positive(message = "ID thư mục đích không hợp lệ")
    private Long targetFolderId;
}