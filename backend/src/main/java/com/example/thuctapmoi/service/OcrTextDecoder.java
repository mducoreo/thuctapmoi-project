package com.example.thuctapmoi.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

@Component
public class OcrTextDecoder {

    private final List<String> characters;

    public OcrTextDecoder(
            @Value("${app.ocr.rec-dict}") String dictionaryPath
    ) throws IOException {
        this.characters = loadCharacters(Path.of(dictionaryPath));
    }

    // Hàm chính: chuyển dự đoán của model thành chữ.
    public String decode(float[][] predictions) {
        StringBuilder text = new StringBuilder();
        int previousIndex = -1;

        for (float[] scores : predictions) {
            if (scores.length != characters.size()) {
                throw new IllegalStateException(
                        "Model có " + scores.length
                                + " lớp nhưng bộ giải mã có "
                                + characters.size() + " mục"
                );
            }

            int currentIndex = findBestIndex(scores);

            if (currentIndex != 0 && currentIndex != previousIndex) {
                text.append(characters.get(currentIndex));
            }

            previousIndex = currentIndex;
        }

        return text.toString();
    }

    // Hàm phụ: chọn vị trí có điểm cao nhất.
    private int findBestIndex(float[] scores) {
        int bestIndex = 0;

        for (int i = 1; i < scores.length; i++) {
            if (scores[i] > scores[bestIndex]) {
                bestIndex = i;
            }
        }

        return bestIndex;
    }

    // Hàm phụ: nạp bộ ký tự đúng thứ tự đã dùng khi huấn luyện.
    private List<String> loadCharacters(Path dictionaryPath)
            throws IOException {

        List<String> dictionary = Files.readAllLines(
                dictionaryPath,
                StandardCharsets.UTF_8
        );

        List<String> result = new ArrayList<>();

        // Vị trí 0 là ký hiệu trống của CTC.
        result.add("");

        for (int i = 0; i < dictionary.size(); i++) {
            String character = dictionary.get(i);

            // Bỏ BOM nếu file có BOM ở đầu.
            if (i == 0 && character.startsWith("\uFEFF")) {
                character = character.substring(1);
            }

            // File của model này có dòng rỗng ở cuối.
            if (character.isEmpty()) {
                if (i != dictionary.size() - 1) {
                    throw new IllegalStateException(
                            "Bộ ký tự có dòng rỗng ở giữa file"
                    );
                }

                continue;
            }

            result.add(character);
        }

        // Dấu cách là lớp cuối cùng.
        result.add(" ");

        if (result.size() != 230) {
            throw new IllegalStateException(
                    "Bộ giải mã của model tiếng Việt phải có 230 mục"
            );
        }

        return List.copyOf(result);
    }
}