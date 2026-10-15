package com.example.thuctapmoi.entity;

public enum OcrStatus {
    PENDING,       // Chưa chạy OCR.
    PROCESSING,    // Đang chạy OCR.
    COMPLETED,     // OCR hoàn thành.
    FAILED         // OCR thất bại.
}