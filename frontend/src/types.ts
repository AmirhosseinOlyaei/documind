export interface Document {
    id: string;
    filename: string;
    contentType: string;
    fileSize: number;
    chunkCount: number;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    errorMessage?: string;
    createdAt: string;
    processedAt?: string;
}

export interface SourceDocument {
    documentId: string;
    filename: string;
    excerpt: string;
    score: number;
}

export interface AnswerResponse {
    answer: string;
    sources: SourceDocument[];
    sessionId: string;
}

export interface ChatMessage {
    id: string;
    question: string;
    answer: string;
    sources?: SourceDocument[];
    isLoading?: boolean;
}
