package com.documind.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DatabaseInitializer {

    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void initializeDatabase() {
        try {
            log.info("Initializing database extensions...");
            
            // Enable pgvector extension
            jdbcTemplate.execute("CREATE EXTENSION IF NOT EXISTS vector");
            log.info("pgvector extension enabled");
            
            // Create document_embeddings table if not exists
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS document_embeddings (
                    embedding_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    embedding vector(384),
                    text TEXT,
                    metadata JSONB
                )
            """);
            log.info("document_embeddings table ready");
            
        } catch (Exception e) {
            log.error("Failed to initialize database: {}", e.getMessage());
            // Don't fail startup - let the app try to work anyway
        }
    }
}
