package com.example.thuctapmoi.service;

import ai.onnxruntime.OrtException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import java.awt.Rectangle;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class OcrService {

    private final OcrDetectionService detectionService;
    private final OcrRecognitionService recognitionService;

    public OcrService(
            OcrDetectionService detectionService,
            OcrRecognitionService recognitionService
    ) {
        this.detectionService = detectionService;
        this.recognitionService = recognitionService;
    }

    // ===== METHOD CHÍNH =====

    // Nhận dữ liệu file và trả về nội dung văn bản.
    public String extractText(byte[] content, String mimeType) {
        if (!"application/pdf".equals(mimeType)
                && !"image/jpeg".equals(mimeType)
                && !"image/png".equals(mimeType)) {
            throw new ResponseStatusException(
                    HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "OCR chỉ hỗ trợ PDF, JPG, JPEG và PNG"
            );
        }

        if (content == null || content.length == 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Tài liệu không có dữ liệu"
            );
        }

        try {
            if ("application/pdf".equals(mimeType)) {
                return extractPdf(content);
            }

            return extractImage(content);

        } catch (IOException | OrtException exception) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Không thể đọc chữ từ tài liệu",
                    exception
            );
        }
    }

    // ===== CÁC METHOD PHỤ =====

    // Đọc ảnh JPG/PNG rồi chạy nhận dạng chữ.
    private String extractImage(byte[] content)
            throws IOException, OrtException {

        try (ByteArrayInputStream input =
                     new ByteArrayInputStream(content)) {

            BufferedImage image = ImageIO.read(input);

            if (image == null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Không thể đọc dữ liệu ảnh"
                );
            }

            return readText(image);
        }
    }

    // Lấy văn bản có sẵn; trang không có văn bản mới chạy OCR.
    private String extractPdf(byte[] content)
            throws IOException, OrtException {

        try (PDDocument pdf = Loader.loadPDF(content)) {
            PDFRenderer renderer = new PDFRenderer(pdf);

            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);

            StringBuilder result = new StringBuilder();

            for (int page = 0; page < pdf.getNumberOfPages(); page++) {
                // PDFTextStripper đánh số trang từ 1.
                stripper.setStartPage(page + 1);
                stripper.setEndPage(page + 1);

                String pageText = stripper.getText(pdf).trim();

                // Trang scan không có lớp văn bản thì OCR từ ảnh.
                if (pageText.isBlank()) {
                    BufferedImage image = renderer.renderImageWithDPI(
                            page,
                            200,
                            ImageType.RGB
                    );

                    pageText = readText(image);
                }

                if (page > 0) {
                    result.append("\n\n");
                }

                result.append(pageText);
            }

            return result.toString().trim();
        }
    }

    // Tìm vùng chữ, gom thành hàng rồi nhận dạng.
    private String readText(BufferedImage image)
            throws OrtException {

        List<Rectangle> regions = new ArrayList<>(
                detectionService.detect(image)
        );

        // Xét các vùng từ trên xuống dưới theo tâm của vùng.
        regions.sort(
                Comparator.comparingDouble(Rectangle::getCenterY)
        );

        List<List<Rectangle>> rows = new ArrayList<>();

        for (Rectangle region : regions) {
            List<Rectangle> matchedRow = null;
            double nearestDistance = Double.MAX_VALUE;

            // Tìm hàng phù hợp với vùng chữ hiện tại.
            for (List<Rectangle> row : rows) {
                Rectangle anchor = row.get(0);

                double distance = Math.abs(
                        region.getCenterY() - anchor.getCenterY()
                );

                double tolerance =
                        Math.min(region.height, anchor.height) * 0.5;

                if (distance <= tolerance
                        && distance < nearestDistance) {
                    matchedRow = row;
                    nearestDistance = distance;
                }
            }

            // Không thuộc hàng nào thì tạo hàng mới.
            if (matchedRow == null) {
                matchedRow = new ArrayList<>();
                rows.add(matchedRow);
            }

            matchedRow.add(region);
        }

        StringBuilder result = new StringBuilder();

        for (List<Rectangle> row : rows) {
            // Trong mỗi hàng, đọc từ trái sang phải.
            row.sort(
                    Comparator.comparingInt(region -> region.x)
            );

            StringBuilder line = new StringBuilder();

            for (Rectangle region : row) {
                BufferedImage lineImage = image.getSubimage(
                        region.x,
                        region.y,
                        region.width,
                        region.height
                );

                String text = recognitionService
                        .recognize(lineImage)
                        .trim();

                if (!text.isEmpty()) {
                    if (!line.isEmpty()) {
                        line.append("\t");
                    }

                    line.append(text);
                }
            }

            if (!line.isEmpty()) {
                if (!result.isEmpty()) {
                    result.append("\n");
                }

                result.append(line);
            }
        }

        return result.toString();
    }
}