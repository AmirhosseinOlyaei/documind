import type { Document, AnswerResponse } from './types';

const API_BASE = '/api';

export async function uploadDocument(file: File): Promise<Document> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/documents/upload`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new Error('Failed to upload document');
    }

    return response.json();
}

export async function getDocuments(): Promise<Document[]> {
    const response = await fetch(`${API_BASE}/documents`);
    if (!response.ok) {
        throw new Error('Failed to fetch documents');
    }
    return response.json();
}

export async function getDocument(id: string): Promise<Document> {
    const response = await fetch(`${API_BASE}/documents/${id}`);
    if (!response.ok) {
        throw new Error('Failed to fetch document');
    }
    return response.json();
}

export async function deleteDocument(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/documents/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error('Failed to delete document');
    }
}

export async function askQuestion(
    question: string,
    sessionId?: string
): Promise<AnswerResponse> {
    const response = await fetch(`${API_BASE}/qa/ask`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question, sessionId }),
    });

    if (!response.ok) {
        throw new Error('Failed to get answer');
    }

    return response.json();
}

export async function clearChatHistory(sessionId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/qa/history/${sessionId}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error('Failed to clear chat history');
    }
}
