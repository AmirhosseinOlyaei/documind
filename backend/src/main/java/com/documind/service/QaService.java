package com.documind.service;

import com.documind.dto.AnswerResponse;
import com.documind.dto.ChatHistoryResponse;
import com.documind.dto.QuestionRequest;
import com.documind.entity.ChatMessage;
import com.documind.repository.ChatMessageRepository;
import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.store.embedding.EmbeddingMatch;
import dev.langchain4j.store.embedding.EmbeddingStore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class QaService {

    private final ChatLanguageModel chatModel;
    private final EmbeddingModel embeddingModel;
    private final EmbeddingStore<TextSegment> embeddingStore;
    private final ChatMessageRepository chatMessageRepository;

    private static final String SYSTEM_PROMPT = """
            You are a helpful assistant that answers questions based on the provided document context.
            
            Instructions:
            - Answer questions only based on the provided context
            - If the context doesn't contain relevant information, say so
            - Be concise but thorough
            - Cite specific parts of the documents when relevant
            
            Context from documents:
            %s
            
            Previous conversation:
            %s
            """;

    public AnswerResponse askQuestion(QuestionRequest request) {
        String sessionId = request.getSessionId();
        if (sessionId == null || sessionId.isBlank()) {
            sessionId = UUID.randomUUID().toString();
        }

        log.info("Processing question for session {}: {}", sessionId, request.getQuestion());

        Embedding questionEmbedding = embeddingModel.embed(request.getQuestion()).content();

        List<EmbeddingMatch<TextSegment>> matches = embeddingStore.findRelevant(questionEmbedding, 5, 0.5);

        String context = matches.stream()
                .map(match -> match.embedded().text())
                .collect(Collectors.joining("\n\n---\n\n"));

        List<ChatMessage> history = chatMessageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
        String conversationHistory = history.stream()
                .map(m -> "User: " + m.getQuestion() + "\nAssistant: " + m.getAnswer())
                .collect(Collectors.joining("\n\n"));

        String systemPrompt = String.format(SYSTEM_PROMPT, 
                context.isEmpty() ? "No relevant documents found." : context,
                conversationHistory.isEmpty() ? "None" : conversationHistory);

        String fullPrompt = systemPrompt + "\n\nUser question: " + request.getQuestion();

        String answer = chatModel.generate(fullPrompt);

        ChatMessage chatMessage = ChatMessage.builder()
                .sessionId(sessionId)
                .question(request.getQuestion())
                .answer(answer)
                .sources(matches.stream()
                        .map(m -> m.embedded().metadata().get("filename"))
                        .filter(f -> f != null)
                        .distinct()
                        .collect(Collectors.joining(", ")))
                .build();
        chatMessageRepository.save(chatMessage);

        List<AnswerResponse.SourceDocument> sources = matches.stream()
                .map(match -> AnswerResponse.SourceDocument.builder()
                        .documentId(match.embedded().metadata().get("documentId"))
                        .filename(match.embedded().metadata().get("filename"))
                        .excerpt(truncate(match.embedded().text(), 200))
                        .score(match.score())
                        .build())
                .toList();

        return AnswerResponse.builder()
                .answer(answer)
                .sources(sources)
                .sessionId(sessionId)
                .build();
    }

    public ChatHistoryResponse getChatHistory(String sessionId) {
        List<ChatMessage> messages = chatMessageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
        return ChatHistoryResponse.from(sessionId, messages);
    }

    @Transactional
    public void clearChatHistory(String sessionId) {
        chatMessageRepository.deleteBySessionId(sessionId);
        log.info("Cleared chat history for session: {}", sessionId);
    }

    private String truncate(String text, int maxLength) {
        if (text == null || text.length() <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + "...";
    }
}
