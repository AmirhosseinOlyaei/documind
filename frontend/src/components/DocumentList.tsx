import { FileText, Trash2, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { formatFileSize, formatDate } from '../lib/utils';
import type { Document } from '../types';

interface DocumentListProps {
  documents: Document[];
  onDelete: (id: string) => void;
}

const statusConfig = {
  PENDING: { icon: Clock, color: 'text-yellow-500', label: 'Pending' },
  PROCESSING: { icon: Loader2, color: 'text-blue-500', label: 'Processing' },
  COMPLETED: { icon: CheckCircle, color: 'text-green-500', label: 'Completed' },
  FAILED: { icon: AlertCircle, color: 'text-red-500', label: 'Failed' },
};

export function DocumentList({ documents, onDelete }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No documents uploaded yet</p>
        <p className="text-sm">Upload a document to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => {
        const status = statusConfig[doc.status];
        const StatusIcon = status.icon;

        return (
          <div
            key={doc.id}
            className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-4">
              <FileText className="w-10 h-10 text-blue-500" />
              <div>
                <p className="font-medium text-gray-900">{doc.filename}</p>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span>{formatFileSize(doc.fileSize)}</span>
                  <span>•</span>
                  <span>{doc.chunkCount} chunks</span>
                  <span>•</span>
                  <span>{formatDate(doc.createdAt)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 ${status.color}`}>
                <StatusIcon
                  className={`w-5 h-5 ${doc.status === 'PROCESSING' ? 'animate-spin' : ''}`}
                />
                <span className="text-sm font-medium">{status.label}</span>
              </div>
              <button
                onClick={() => onDelete(doc.id)}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                title="Delete document"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
