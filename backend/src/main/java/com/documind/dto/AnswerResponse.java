package com.documind.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class AnswerResponse {
    private String answer;
    private List<SourceDocument> sources;
    private String sessionId;

    @Data
    @Builder
    public static class SourceDocument {
        private String documentId;
        private String filename;
        private String excerpt;
        private Double score;
    }
}
