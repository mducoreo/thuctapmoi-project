package com.example.thuctapmoi.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class DocumentTextRequest {

    @NotNull(message = "Nội dung OCR không được null")
    private String extractedText;
}