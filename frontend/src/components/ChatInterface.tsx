import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, RotateCcw, Bot, User } from 'lucide-react';
import { askQuestion, clearChatHistory } from '../api';
import type { ChatMessage, SourceDocument } from '../types';

interface ChatInterfaceProps {
  hasDocuments: boolean;
}

export function ChatInterface({ hasDocuments }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const question = input.trim();
    setInput('');

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      question,
      answer: '',
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await askQuestion(question, sessionId);
      setSessionId(response.sessionId);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === userMessage.id
            ? {
                ...msg,
                answer: response.answer,
                sources: response.sources,
                isLoading: false,
              }
            : msg
        )
      );
    } catch (error) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === userMessage.id
            ? {
                ...msg,
                answer: 'Sorry, an error occurred. Please try again.',
                isLoading: false,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    if (sessionId) {
      try {
        await clearChatHistory(sessionId);
      } catch (error) {
        console.error('Failed to clear history:', error);
      }
    }
    setMessages([]);
    setSessionId(undefined);
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-lg border border-gray-200">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Chat with your Documents</h2>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Clear Chat
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Bot className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Ask a question about your documents</p>
              <p className="text-sm mt-2">
                {hasDocuments
                  ? 'Your documents are ready. Start asking questions!'
                  : 'Upload some documents first to get started.'}
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-gray-900">{message.question}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Bot className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  {message.isLoading ? (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Thinking...
                    </div>
                  ) : (
                    <>
                      <p className="text-gray-900 whitespace-pre-wrap">{message.answer}</p>
                      {message.sources && message.sources.length > 0 && (
                        <SourcesList sources={message.sources} />
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              hasDocuments
                ? 'Ask a question about your documents...'
                : 'Upload documents first...'
            }
            disabled={!hasDocuments || isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!hasDocuments || !input.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}

function SourcesList({ sources }: { sources: SourceDocument[] }) {
  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
      <p className="text-sm font-medium text-gray-700 mb-2">Sources:</p>
      <div className="space-y-2">
        {sources.map((source, idx) => (
          <div key={idx} className="text-sm">
            <span className="font-medium text-blue-600">{source.filename}</span>
            <span className="text-gray-400 ml-2">
              (relevance: {(source.score * 100).toFixed(0)}%)
            </span>
            <p className="text-gray-600 mt-1 text-xs italic">"{source.excerpt}"</p>
          </div>
        ))}
      </div>
    </div>
  );
}
