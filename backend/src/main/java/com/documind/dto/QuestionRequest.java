package com.documind.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class QuestionRequest {
    
    @NotBlank(message = "Question is required")
    @Size(max = 5000, message = "Question must be less than 5000 characters")
    private String question;
    
    private String sessionId;
}
