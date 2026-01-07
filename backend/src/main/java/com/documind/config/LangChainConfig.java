package com.documind.config;

import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.embedding.onnx.allminilml6v2.AllMiniLmL6V2EmbeddingModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.pgvector.PgVectorEmbeddingStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class LangChainConfig {

    @Value("${documind.openai.api-key}")
    private String openAiApiKey;

    @Value("${documind.openai.model}")
    private String openAiModel;

    @Value("${spring.datasource.url}")
    private String datasourceUrl;

    @Value("${spring.datasource.username}")
    private String datasourceUsername;

    @Value("${spring.datasource.password}")
    private String datasourcePassword;

    @Value("${documind.vector-store.dimension}")
    private int vectorDimension;

    @Value("${documind.vector-store.table-name}")
    private String tableName;

    @Bean
    public ChatLanguageModel chatLanguageModel() {
        return OpenAiChatModel.builder()
                .apiKey(openAiApiKey)
                .modelName(openAiModel)
                .temperature(0.7)
                .maxTokens(1000)
                .build();
    }

    @Bean
    public EmbeddingModel embeddingModel() {
        return new AllMiniLmL6V2EmbeddingModel();
    }

    @Bean
    public EmbeddingStore<TextSegment> embeddingStore() {
        String host = extractHost(datasourceUrl);
        int port = extractPort(datasourceUrl);
        String database = extractDatabase(datasourceUrl);

        return PgVectorEmbeddingStore.builder()
                .host(host)
                .port(port)
                .database(database)
                .user(datasourceUsername)
                .password(datasourcePassword)
                .table(tableName)
                .dimension(vectorDimension)
                .build();
    }

    private String extractHost(String url) {
        String withoutPrefix = url.replace("jdbc:postgresql://", "");
        return withoutPrefix.split(":")[0];
    }

    private int extractPort(String url) {
        String withoutPrefix = url.replace("jdbc:postgresql://", "");
        String portAndDb = withoutPrefix.split(":")[1];
        return Integer.parseInt(portAndDb.split("/")[0]);
    }

    private String extractDatabase(String url) {
        return url.substring(url.lastIndexOf("/") + 1);
    }
}
