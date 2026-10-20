package com.example.thuctapmoi.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

@Getter
@AllArgsConstructor
public class DocumentPageResponse {

    // Danh sách tài liệu trong trang hiện tại.
    private List<DocumentResponse> items;

    // Số thứ tự trang hiện tại, bắt đầu từ 0.
    private int page;

    // Số tài liệu tối đa mỗi trang.
    private int size;

    // Tổng số tài liệu khớp điều kiện tìm kiếm.
    private long totalElements;

    // Tổng số trang.
    private int totalPages;
}