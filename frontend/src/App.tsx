import { useState, useEffect } from 'react';
import { FileText, MessageSquare, RefreshCw } from 'lucide-react';
import { DocumentUpload } from './components/DocumentUpload';
import { DocumentList } from './components/DocumentList';
import { ChatInterface } from './components/ChatInterface';
import { getDocuments, deleteDocument, getDocument } from './api';
import type { Document } from './types';

function App() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeTab, setActiveTab] = useState<'documents' | 'chat'>('documents');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDocuments = async () => {
    try {
      const docs = await getDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    const processingDocs = documents.filter(
      (d) => d.status === 'PENDING' || d.status === 'PROCESSING'
    );

    if (processingDocs.length > 0) {
      const interval = setInterval(async () => {
        for (const doc of processingDocs) {
          try {
            const updated = await getDocument(doc.id);
            setDocuments((prev) =>
              prev.map((d) => (d.id === updated.id ? updated : d))
            );
          } catch (error) {
            console.error('Failed to fetch document status:', error);
          }
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [documents]);

  const handleUploadComplete = (doc: Document) => {
    setDocuments((prev) => [doc, ...prev]);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchDocuments();
    setIsRefreshing(false);
  };

  const completedDocs = documents.filter((d) => d.status === 'COMPLETED');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">DocuMind</h1>
              <p className="text-gray-600">AI-powered Document Q&A</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                {completedDocs.length} docs ready
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'documents'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <FileText className="w-5 h-5" />
            Documents
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'chat'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            Chat
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {activeTab === 'documents' ? (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Upload Document
              </h2>
              <DocumentUpload onUploadComplete={handleUploadComplete} />
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Your Documents
              </h2>
              <DocumentList documents={documents} onDelete={handleDelete} />
            </div>
          </div>
        ) : (
          <ChatInterface hasDocuments={completedDocs.length > 0} />
        )}
      </main>

      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
          <p>
            Built with Spring Boot, LangChain4j, React, and AWS CDK
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
