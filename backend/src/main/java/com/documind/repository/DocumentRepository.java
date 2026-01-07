package com.documind.repository;

import com.documind.entity.Document;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DocumentRepository extends JpaRepository<Document, String> {
    List<Document> findByStatusOrderByCreatedAtDesc(Document.ProcessingStatus status);
    List<Document> findAllByOrderByCreatedAtDesc();
}
