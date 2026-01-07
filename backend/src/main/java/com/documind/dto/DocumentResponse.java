package com.documind.dto;

import com.documind.entity.Document;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class DocumentResponse {
    private String id;
    private String filename;
    private String contentType;
    private Long fileSize;
    private Integer chunkCount;
    private String status;
    private String errorMessage;
    private LocalDateTime createdAt;
    private LocalDateTime processedAt;

    public static DocumentResponse from(Document document) {
        return DocumentResponse.builder()
                .id(document.getId())
                .filename(document.getFilename())
                .contentType(document.getContentType())
                .fileSize(document.getFileSize())
                .chunkCount(document.getChunkCount())
                .status(document.getStatus().name())
                .errorMessage(document.getErrorMessage())
                .createdAt(document.getCreatedAt())
                .processedAt(document.getProcessedAt())
                .build();
    }
}
