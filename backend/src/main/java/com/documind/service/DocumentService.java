package com.documind.service;

import com.documind.dto.DocumentResponse;
import com.documind.entity.Document;
import com.documind.repository.DocumentRepository;
import dev.langchain4j.data.document.DocumentParser;
import dev.langchain4j.data.document.Metadata;
import dev.langchain4j.data.document.parser.apache.pdfbox.ApachePdfBoxDocumentParser;
import dev.langchain4j.data.document.splitter.DocumentSplitters;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.store.embedding.EmbeddingStore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final EmbeddingModel embeddingModel;
    private final EmbeddingStore<TextSegment> embeddingStore;

    public DocumentResponse uploadDocument(MultipartFile file) {
        log.info("Uploading document: {}", file.getOriginalFilename());

        Document document = Document.builder()
                .filename(file.getOriginalFilename())
                .contentType(file.getContentType())
                .fileSize(file.getSize())
                .chunkCount(0)
                .status(Document.ProcessingStatus.PENDING)
                .build();

        document = documentRepository.save(document);

        processDocumentAsync(document.getId(), file);

        return DocumentResponse.from(document);
    }

    @Async
    public void processDocumentAsync(String documentId, MultipartFile file) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new RuntimeException("Document not found: " + documentId));

        try {
            document.setStatus(Document.ProcessingStatus.PROCESSING);
            documentRepository.save(document);

            byte[] content = file.getBytes();
            dev.langchain4j.data.document.Document langchainDoc = parseDocument(content, file.getContentType());

            var splitter = DocumentSplitters.recursive(500, 50);
            List<TextSegment> rawSegments = splitter.split(langchainDoc);

            List<TextSegment> segments = new ArrayList<>();
            for (TextSegment segment : rawSegments) {
                Metadata metadata = Metadata.from("documentId", documentId)
                        .add("filename", file.getOriginalFilename());
                segments.add(TextSegment.from(segment.text(), metadata));
            }

            var embeddings = embeddingModel.embedAll(segments).content();
            embeddingStore.addAll(embeddings, segments);

            document.setChunkCount(segments.size());
            document.setStatus(Document.ProcessingStatus.COMPLETED);
            document.setProcessedAt(LocalDateTime.now());
            documentRepository.save(document);

            log.info("Document processed successfully: {} with {} chunks", documentId, segments.size());

        } catch (Exception e) {
            log.error("Failed to process document: {}", documentId, e);
            document.setStatus(Document.ProcessingStatus.FAILED);
            document.setErrorMessage(e.getMessage());
            documentRepository.save(document);
        }
    }

    private dev.langchain4j.data.document.Document parseDocument(byte[] content, String contentType) {
        if (contentType != null && contentType.contains("pdf")) {
            DocumentParser parser = new ApachePdfBoxDocumentParser();
            return parser.parse(new ByteArrayInputStream(content));
        } else {
            String text = new String(content);
            return dev.langchain4j.data.document.Document.from(text);
        }
    }

    public List<DocumentResponse> getAllDocuments() {
        return documentRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(DocumentResponse::from)
                .toList();
    }

    public DocumentResponse getDocument(String id) {
        return documentRepository.findById(id)
                .map(DocumentResponse::from)
                .orElseThrow(() -> new RuntimeException("Document not found: " + id));
    }

    public void deleteDocument(String id) {
        documentRepository.deleteById(id);
        log.info("Document deleted: {}", id);
    }
}
