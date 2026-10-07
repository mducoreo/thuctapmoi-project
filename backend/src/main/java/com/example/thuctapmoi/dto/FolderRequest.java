package com.example.thuctapmoi.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FolderRequest {

    @NotBlank(message = "Tên folder không được để trống")
    @Size(max = 100, message = "Tên folder tối đa 100 ký tự")
    private String name;

    @Positive(message = "ID folder cha phải lớn hơn 0")
    private Long parentId;
}