package com.example.thuctapmoi.service;

import org.apache.pdfbox.Loader;
import java.io.ByteArrayOutputStream;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.tika.exception.TikaException;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.parser.ocr.TesseractOCRParser;
import org.apache.tika.sax.BodyContentHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.xml.sax.SAXException;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Map;

@Service
public class OcrService {

    private final String tesseractPath;
    private final String tessdataPath;
    private final String language;

    public OcrService(
            @Value("${ocr.tesseract-path}") String tesseractPath,
            @Value("${ocr.tessdata-path}") String tessdataPath,
            @Value("${ocr.language:vie+eng}") String language
    ) {
        this.tesseractPath = tesseractPath;
        this.tessdataPath = tessdataPath;
        this.language = language;
    }

    // ===== METHOD CHÍNH =====

    // Nhận dữ liệu file và trả về nội dung chữ đọc được.
    public String extractText(byte[] content, String mimeType) {
        if (!"application/pdf".equals(mimeType)
                && !"image/jpeg".equals(mimeType)
                && !"image/png".equals(mimeType)) {
            throw new ResponseStatusException(
                    HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "OCR chỉ hỗ trợ PDF, JPG, JPEG và PNG"
            );
        }

        try {
            TesseractOCRParser parser = createParser();

            if ("application/pdf".equals(mimeType)) {
                return extractPdf(content, parser);
            }

            return extractImage(content, parser);

        } catch (IOException | SAXException | TikaException exception) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Không thể đọc chữ từ tài liệu",
                    exception
            );
        }
    }

    // ===== CÁC METHOD PHỤ =====

    // Chuẩn bị bộ OCR với đường dẫn và ngôn ngữ đã cấu hình.
    private TesseractOCRParser createParser() throws TikaException {
        TesseractOCRParser parser = new TesseractOCRParser();

        parser.setTesseractPath(tesseractPath);
        parser.setTessdataPath(tessdataPath);
        parser.setLanguage(language);
        parser.setOutputType("txt");
        parser.setPageSegMode("3");

        // Giới hạn thời gian cho mỗi ảnh hoặc trang được OCR.
        parser.setTimeout(120);

        // Không yêu cầu cài thêm ImageMagick để xử lý ảnh.
        parser.setEnableImagePreprocessing(false);

        parser.initialize(Map.of());

        if (!parser.hasTesseract()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Không tìm thấy Tesseract, hãy kiểm tra cấu hình OCR"
            );
        }

        return parser;
    }

    // Đọc ảnh JPG/PNG từ dữ liệu file rồi đưa vào OCR.
    private String extractImage(
            byte[] content,
            TesseractOCRParser parser
    ) throws IOException, SAXException, TikaException {
        try (ByteArrayInputStream input =
                     new ByteArrayInputStream(content)) {

            BufferedImage image = ImageIO.read(input);

            if (image == null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Không thể đọc dữ liệu ảnh"
                );
            }

            return readText(image, parser);
        }
    }

    // Chuyển từng trang PDF thành ảnh rồi đọc chữ.
    private String extractPdf(
            byte[] content,
            TesseractOCRParser parser
    ) throws IOException, SAXException, TikaException {
        try (PDDocument pdf = Loader.loadPDF(content)) {
            PDFRenderer renderer = new PDFRenderer(pdf);
            StringBuilder result = new StringBuilder();

            for (int page = 0; page < pdf.getNumberOfPages(); page++) {
                BufferedImage image = renderer.renderImageWithDPI(
                        page,
                        200,
                        ImageType.GRAY
                );

                String pageText = readText(image, parser);

                if (page > 0) {
                    result.append("\n\n");
                }

                result.append(pageText);
            }

            return result.toString().trim();
        }
    }

    // Chuyển ảnh gốc thành dữ liệu PNG rồi đưa vào Tika/Tesseract.
    private String readText(
            BufferedImage image,
            TesseractOCRParser parser
    ) throws IOException, SAXException, TikaException {
        byte[] imageBytes;

        try (ByteArrayOutputStream output =
                     new ByteArrayOutputStream()) {

            boolean written = ImageIO.write(image, "png", output);

            if (!written) {
                throw new IOException(
                        "Không thể chuyển ảnh thành dữ liệu PNG"
                );
            }

            imageBytes = output.toByteArray();
        }

        BodyContentHandler handler =
                new BodyContentHandler(1_000_000);

        Metadata metadata = new Metadata();
        ParseContext context = new ParseContext();

        try (ByteArrayInputStream input =
                     new ByteArrayInputStream(imageBytes)) {

            parser.parse(input, handler, metadata, context);
        }

        return handler.toString().trim();
    }

}