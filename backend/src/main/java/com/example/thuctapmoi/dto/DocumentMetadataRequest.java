package com.example.thuctapmoi.dto;
import org.springframework.format.annotation.DateTimeFormat;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
public class DocumentMetadataRequest {

    @NotBlank(message = "Tên văn bản không được để trống")
    @Size(max = 255, message = "Tên văn bản tối đa 255 ký tự")
    private String title;

    @Size(max = 100, message = "Số hiệu tối đa 100 ký tự")
    private String documentNumber;

    @Size(max = 100, message = "Loại văn bản tối đa 100 ký tự")
    private String documentType;

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate issuedDate;

    @Size(max = 255, message = "Đơn vị/người ban hành tối đa 255 ký tự")
    private String issuer;

    @Size(max = 500, message = "Từ khóa tối đa 500 ký tự")
    private String keywords;

    @Size(max = 2000, message = "Mô tả tối đa 2000 ký tự")
    private String description;
}