package com.example.thuctapmoi.service;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtException;
import ai.onnxruntime.OrtSession;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.nio.FloatBuffer;
import java.util.Map;

@Service
public class OcrRecognitionService {

    private static final int IMAGE_HEIGHT = 48;
    private static final int MAX_INPUT_WIDTH = 640;

    private final OrtSession recognitionSession;
    private final OcrTextDecoder decoder;

    public OcrRecognitionService(
            @Qualifier("ocrRecognitionSession")
            OrtSession recognitionSession,
            OcrTextDecoder decoder
    ) {
        this.recognitionSession = recognitionSession;
        this.decoder = decoder;
    }

    // Hàm chính: chia dòng dài thành các đoạn rồi nhận dạng.
    public String recognize(BufferedImage lineImage)
            throws OrtException {

        if (lineImage == null) {
            throw new IllegalArgumentException(
                    "Ảnh không được để trống"
            );
        }

        // Chiều rộng ảnh gốc tương ứng với đầu vào tối đa 640 pixel.
        int maxSegmentWidth = Math.max(
                1,
                (int) Math.floor(
                        (double) lineImage.getHeight()
                                * MAX_INPUT_WIDTH
                                / IMAGE_HEIGHT
                )
        );

        int[] inkCounts = countInkByColumn(lineImage);

        StringBuilder result = new StringBuilder();
        int startX = 0;

        while (lineImage.getWidth() - startX > maxSegmentWidth) {
            int splitX = findSplitPosition(
                    inkCounts,
                    startX,
                    maxSegmentWidth,
                    lineImage.getHeight()
            );

            if (splitX <= startX) {
                throw new IllegalStateException(
                        "Vùng chữ quá dài và không tìm được "
                                + "khoảng trắng để chia đoạn"
                );
            }

            BufferedImage segment = lineImage.getSubimage(
                    startX,
                    0,
                    splitX - startX,
                    lineImage.getHeight()
            );

            appendText(result, recognizeSegment(segment));
            startX = splitX;
        }

        BufferedImage lastSegment = lineImage.getSubimage(
                startX,
                0,
                lineImage.getWidth() - startX,
                lineImage.getHeight()
        );

        appendText(result, recognizeSegment(lastSegment));

        return result.toString();
    }

    // Hàm phụ: đếm điểm tối trên từng cột để tìm khoảng trắng.
    private int[] countInkByColumn(BufferedImage image) {
        int[] counts = new int[image.getWidth()];

        for (int x = 0; x < image.getWidth(); x++) {
            for (int y = 0; y < image.getHeight(); y++) {
                int rgb = image.getRGB(x, y);

                int red = (rgb >> 16) & 255;
                int green = (rgb >> 8) & 255;
                int blue = rgb & 255;

                if (Math.min(red, Math.min(green, blue)) < 160) {
                    counts[x]++;
                }
            }
        }

        return counts;
    }

    // Hàm phụ: chọn khoảng trắng gần cuối đoạn cho phép.
    private int findSplitPosition(
            int[] inkCounts,
            int startX,
            int maxWidth,
            int imageHeight
    ) {
        int limit = Math.min(inkCounts.length, startX + maxWidth);
        int minimumX = startX + (int) (maxWidth * 0.35);
        int minimumGap = Math.max(
                2,
                (int) Math.round(imageHeight * 0.1)
        );

        int gapStart = -1;
        int bestSplit = -1;

        for (int x = startX; x < limit; x++) {
            if (inkCounts[x] == 0) {
                if (gapStart == -1) {
                    gapStart = x;
                }
            } else if (gapStart != -1) {
                int gapWidth = x - gapStart;

                if (gapStart >= minimumX
                        && gapWidth >= minimumGap) {
                    bestSplit = gapStart + gapWidth / 2;
                }

                gapStart = -1;
            }
        }

        return bestSplit;
    }

    // Hàm phụ: ghép các đoạn chữ bằng dấu cách.
    private void appendText(StringBuilder result, String text) {
        String cleaned = text.trim();

        if (cleaned.isEmpty()) {
            return;
        }

        if (!result.isEmpty()) {
            result.append(" ");
        }

        result.append(cleaned);
    }

    // Hàm phụ: chạy model trên một đoạn vừa kích thước.
    private String recognizeSegment(BufferedImage image)
            throws OrtException {

        int resizedWidth = Math.max(
                1,
                (int) Math.ceil(
                        (double) image.getWidth()
                                / image.getHeight()
                                * IMAGE_HEIGHT
                )
        );

        if (resizedWidth > MAX_INPUT_WIDTH) {
            throw new IllegalArgumentException(
                    "Đoạn ảnh vượt chiều rộng nhận dạng"
            );
        }

        int inputWidth = resizedWidth <= 320 ? 320 : 640;

        BufferedImage resized = resizeImage(image, resizedWidth);
        FloatBuffer inputData = prepareInput(resized, inputWidth);

        long[] shape = {1, 3, IMAGE_HEIGHT, inputWidth};

        String inputName = recognitionSession
                .getInputNames()
                .iterator()
                .next();

        try (
                OnnxTensor tensor = OnnxTensor.createTensor(
                        OrtEnvironment.getEnvironment(),
                        inputData,
                        shape
                );
                OrtSession.Result result = recognitionSession.run(
                        Map.of(inputName, tensor)
                )
        ) {
            Object output = result.get(0).getValue();

            if (!(output instanceof float[][][] predictions)
                    || predictions.length != 1) {
                throw new IllegalStateException(
                        "Đầu ra model nhận dạng không đúng cấu trúc"
                );
            }

            return decoder.decode(predictions[0]);
        }
    }

    // Hàm phụ: đổi kích thước ảnh.
    private BufferedImage resizeImage(
            BufferedImage source,
            int width
    ) {
        BufferedImage resized = new BufferedImage(
                width,
                IMAGE_HEIGHT,
                BufferedImage.TYPE_INT_RGB
        );

        Graphics2D graphics = resized.createGraphics();

        try {
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, width, IMAGE_HEIGHT);

            graphics.setRenderingHint(
                    RenderingHints.KEY_INTERPOLATION,
                    RenderingHints.VALUE_INTERPOLATION_BILINEAR
            );

            graphics.drawImage(
                    source,
                    0,
                    0,
                    width,
                    IMAGE_HEIGHT,
                    null
            );
        } finally {
            graphics.dispose();
        }

        return resized;
    }

    // Hàm phụ: chuyển ảnh thành dữ liệu BGR đã chuẩn hóa.
    private FloatBuffer prepareInput(
            BufferedImage image,
            int inputWidth
    ) {
        int planeSize = IMAGE_HEIGHT * inputWidth;
        float[] data = new float[3 * planeSize];

        for (int y = 0; y < IMAGE_HEIGHT; y++) {
            for (int x = 0; x < image.getWidth(); x++) {
                int rgb = image.getRGB(x, y);

                int blue = rgb & 255;
                int green = (rgb >> 8) & 255;
                int red = (rgb >> 16) & 255;

                int index = y * inputWidth + x;

                data[index] = blue / 127.5f - 1;
                data[planeSize + index] = green / 127.5f - 1;
                data[2 * planeSize + index] = red / 127.5f - 1;
            }
        }

        return FloatBuffer.wrap(data);
    }
}