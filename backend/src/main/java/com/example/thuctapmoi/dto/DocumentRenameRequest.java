package com.example.thuctapmoi.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DocumentRenameRequest {

    @NotBlank(message = "Tên file không được để trống")
    @Size(max = 255, message = "Tên file không được quá 255 ký tự")
    private String originalName;
}