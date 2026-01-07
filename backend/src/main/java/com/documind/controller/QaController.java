package com.documind.controller;

import com.documind.dto.AnswerResponse;
import com.documind.dto.ChatHistoryResponse;
import com.documind.dto.QuestionRequest;
import com.documind.service.QaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/qa")
@RequiredArgsConstructor
public class QaController {

    private final QaService qaService;

    @PostMapping("/ask")
    public ResponseEntity<AnswerResponse> askQuestion(@Valid @RequestBody QuestionRequest request) {
        return ResponseEntity.ok(qaService.askQuestion(request));
    }

    @GetMapping("/history/{sessionId}")
    public ResponseEntity<ChatHistoryResponse> getChatHistory(@PathVariable String sessionId) {
        return ResponseEntity.ok(qaService.getChatHistory(sessionId));
    }

    @DeleteMapping("/history/{sessionId}")
    public ResponseEntity<Void> clearChatHistory(@PathVariable String sessionId) {
        qaService.clearChatHistory(sessionId);
        return ResponseEntity.noContent().build();
    }
}
