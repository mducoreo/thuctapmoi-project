package com.example.thuctapmoi.config;

import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtException;
import ai.onnxruntime.OrtSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OcrModelConfig {

    // Nạp model tìm vị trí chữ.
    @Bean(destroyMethod = "close")
    public OrtSession ocrDetectionSession(
            @Value("${app.ocr.det-model}") String modelPath
    ) throws OrtException {
        return loadModel(modelPath);
    }

    // Nạp model đọc chữ.
    @Bean(destroyMethod = "close")
    public OrtSession ocrRecognitionSession(
            @Value("${app.ocr.rec-model}") String modelPath
    ) throws OrtException {
        return loadModel(modelPath);
    }

    // Hàm phụ dùng chung để nạp một file model.
    private OrtSession loadModel(String modelPath) throws OrtException {
        OrtEnvironment environment = OrtEnvironment.getEnvironment();

        try (OrtSession.SessionOptions options =
                     new OrtSession.SessionOptions()) {
            return environment.createSession(modelPath, options);
        }
    }
}