package com.documind.dto;

import com.documind.entity.ChatMessage;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class ChatHistoryResponse {
    private String sessionId;
    private List<Message> messages;

    @Data
    @Builder
    public static class Message {
        private String id;
        private String question;
        private String answer;
        private LocalDateTime timestamp;
    }

    public static ChatHistoryResponse from(String sessionId, List<ChatMessage> messages) {
        return ChatHistoryResponse.builder()
                .sessionId(sessionId)
                .messages(messages.stream()
                        .map(m -> Message.builder()
                                .id(m.getId())
                                .question(m.getQuestion())
                                .answer(m.getAnswer())
                                .timestamp(m.getCreatedAt())
                                .build())
                        .toList())
                .build();
    }
}
