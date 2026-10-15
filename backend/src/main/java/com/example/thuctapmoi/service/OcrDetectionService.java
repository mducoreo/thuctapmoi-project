package com.example.thuctapmoi.service;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtException;
import ai.onnxruntime.OrtSession;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.Rectangle;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.nio.FloatBuffer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Service
public class OcrDetectionService {

    private static final int MAX_SIDE = 960;
    private static final float PIXEL_THRESHOLD = 0.3f;
    private static final float REGION_THRESHOLD = 0.6f;

    private final OrtSession detectionSession;

    public OcrDetectionService(
            @Qualifier("ocrDetectionSession")
            OrtSession detectionSession
    ) {
        this.detectionSession = detectionSession;
    }

    // Hàm chính: tìm các vùng chữ trên ảnh.
    public List<Rectangle> detect(BufferedImage image)
            throws OrtException {
     // tinh kich thuoc anh can xuli
        double ratio = Math.min(
                1.0,
                (double) MAX_SIDE
                        / Math.max(image.getWidth(), image.getHeight())
        );

        int width = roundTo32(image.getWidth() * ratio);
        int height = roundTo32(image.getHeight() * ratio);

        BufferedImage resized = resizeImage(image, width, height);
        FloatBuffer inputData = prepareInput(resized);

        String inputName = detectionSession
                .getInputNames()
                .iterator()
                .next();

        long[] shape = {1, 3, height, width};

        try (
                OnnxTensor tensor = OnnxTensor.createTensor(
                        OrtEnvironment.getEnvironment(),
                        inputData,
                        shape
                );
                OrtSession.Result result = detectionSession.run(
                        Map.of(inputName, tensor)
                )
        ) {
            Object output = result.get(0).getValue();

            if (!(output instanceof float[][][][] predictions)
                    || predictions.length != 1
                    || predictions[0].length != 1) {
                throw new IllegalStateException(
                        "Đầu ra model tìm vùng chữ không đúng cấu trúc"
                );
            }

            return findRegions(
                    predictions[0][0],
                    image.getWidth(),
                    image.getHeight()
            );
        }
    }

    // Hàm phụ: làm tròn kích thước thành bội số của 32.
    private int roundTo32(double value) {
        return Math.max(32, (int) Math.round(value / 32.0) * 32);
    }

    // Hàm phụ: đổi kích thước ảnh.
    private BufferedImage resizeImage(
            BufferedImage source,
            int width,
            int height
    ) {
        BufferedImage resized = new BufferedImage(
                width,
                height,
                BufferedImage.TYPE_INT_RGB
        );

        Graphics2D graphics = resized.createGraphics();

        try {
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, width, height);

            graphics.setRenderingHint(
                    RenderingHints.KEY_INTERPOLATION,
                    RenderingHints.VALUE_INTERPOLATION_BILINEAR
            );

            graphics.drawImage(
                    source,
                    0,
                    0,
                    width,
                    height,
                    null
            );
        } finally {
            graphics.dispose();
        }

        return resized;
    }

    // Hàm phụ: chuyển ảnh thành dữ liệu BGR đã chuẩn hóa.
    private FloatBuffer prepareInput(BufferedImage image) {
        int width = image.getWidth();
        int height = image.getHeight();
        int planeSize = width * height;

        float[] data = new float[3 * planeSize];

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int rgb = image.getRGB(x, y);

                int blue = rgb & 255;
                int green = (rgb >> 8) & 255;
                int red = (rgb >> 16) & 255;

                int index = y * width + x;

                data[index] =
                        (blue / 255.0f - 0.485f) / 0.229f;

                data[planeSize + index] =
                        (green / 255.0f - 0.456f) / 0.224f;

                data[2 * planeSize + index] =
                        (red / 255.0f - 0.406f) / 0.225f;
            }
        }

        return FloatBuffer.wrap(data);
    }

    // Hàm phụ: gom các điểm dự đoán liền nhau thành vùng chữ.
    private List<Rectangle> findRegions(
            float[][] heatmap,
            int originalWidth,
            int originalHeight
    ) {
        int height = heatmap.length;
        int width = heatmap[0].length;

        boolean[] visited = new boolean[width * height];
        int[] queue = new int[width * height];

        List<Rectangle> regions = new ArrayList<>();

        double scaleX = (double) originalWidth / width;
        double scaleY = (double) originalHeight / height;

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int start = y * width + x;

                if (visited[start]
                        || heatmap[y][x] <= PIXEL_THRESHOLD) {
                    continue;
                }

                int head = 0;
                int tail = 0;

                queue[tail++] = start;
                visited[start] = true;

                int minX = x;
                int maxX = x;
                int minY = y;
                int maxY = y;

                double scoreSum = 0;

                while (head < tail) {
                    int current = queue[head++];

                    int currentX = current % width;
                    int currentY = current / width;

                    minX = Math.min(minX, currentX);
                    maxX = Math.max(maxX, currentX);
                    minY = Math.min(minY, currentY);
                    maxY = Math.max(maxY, currentY);

                    scoreSum += heatmap[currentY][currentX];

                    // Xét 8 điểm nằm xung quanh điểm hiện tại.
                    for (int dy = -1; dy <= 1; dy++) {
                        for (int dx = -1; dx <= 1; dx++) {
                            int nextX = currentX + dx;
                            int nextY = currentY + dy;

                            if (nextX < 0 || nextX >= width
                                    || nextY < 0 || nextY >= height) {
                                continue;
                            }

                            int next = nextY * width + nextX;

                            if (!visited[next]
                                    && heatmap[nextY][nextX]
                                    > PIXEL_THRESHOLD) {
                                visited[next] = true;
                                queue[tail++] = next;
                            }
                        }
                    }
                }

                int regionWidth = maxX - minX + 1;
                int regionHeight = maxY - minY + 1;

                // Bỏ vùng quá nhỏ hoặc có điểm trung bình thấp.
                if (regionWidth < 3
                        || regionHeight < 3
                        || scoreSum / tail < REGION_THRESHOLD) {
                    continue;
                }

                // Mở rộng khung để hạn chế cắt mất nét và dấu.
                double padding =
                        Math.min(regionWidth, regionHeight) * 0.5;

                int left = Math.max(
                        0,
                        (int) Math.floor((minX - padding) * scaleX)
                );

                int top = Math.max(
                        0,
                        (int) Math.floor((minY - padding) * scaleY)
                );

                int right = Math.min(
                        originalWidth,
                        (int) Math.ceil((maxX + 1 + padding) * scaleX)
                );

                int bottom = Math.min(
                        originalHeight,
                        (int) Math.ceil((maxY + 1 + padding) * scaleY)
                );

                if (right > left && bottom > top) {
                    regions.add(new Rectangle(
                            left,
                            top,
                            right - left,
                            bottom - top
                    ));
                }
            }
        }

        // Sắp xếp cơ bản từ trên xuống dưới.
        regions.sort(
                Comparator.comparingInt((Rectangle box) -> box.y)
                        .thenComparingInt(box -> box.x)
        );

        return regions;
    }
}