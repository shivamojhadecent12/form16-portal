import { useState, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import { useDocuments, useDeleteDocument, useReplaceDocument } from '@/hooks/useDocuments';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';

export function AdminManageFiles() {
  const { data: documents, isLoading, error } = useDocuments();
  const deleteDoc = useDeleteDocument();
  const replaceDoc = useReplaceDocument();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = documents?.filter((doc) => {
    const matchType = filterType === 'all' || doc.document_type === filterType;
    const term = searchTerm.toLowerCase();
    const matchSearch =
      (doc.employee_name ?? '').toLowerCase().includes(term) ||
      (doc.employee_pan ?? '').toLowerCase().includes(term) ||
      doc.financial_year.includes(term) ||
      doc.file_name.toLowerCase().includes(term);
    return matchType && matchSearch;
  });

  function flash(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  }

  async function handleDelete(id: string) {
    try {
      await deleteDoc.mutateAsync(id);
      setConfirmDelete(null);
      flash('Document deleted successfully.');
    } catch {
      setReplaceError('Failed to delete document.');
    }
  }

  async function handleReplaceFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!replacingId || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setReplaceError(null);
    try {
      await replaceDoc.mutateAsync({ id: replacingId, file });
      setReplacingId(null);
      flash(`Replaced with "${file.name}" successfully.`);
    } catch {
      setReplaceError('Failed to replace document. Make sure it is a valid PDF.');
    }
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function previewUrl(id: string) {
    const token = localStorage.getItem('auth_token') ?? '';
    return `${BASE_URL}/documents/${id}/preview?token=${token}`;
  }

  function downloadUrl(id: string) {
    const token = localStorage.getItem('auth_token') ?? '';
    return `${BASE_URL}/documents/${id}/download?token=${token}`;
  }

  if (isLoading) return <Layout><LoadingSpinner /></Layout>;
  if (error) return <Layout><ErrorMessage message="Failed to load documents" /></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Files</h1>
          <p className="text-gray-600 mt-1">Delete or replace Form-16 and other documents</p>
        </div>

        {/* Feedback banners */}
        {successMsg && (
          <div className="card bg-green-50 border-green-200">
            <p className="text-green-800 font-medium">✅ {successMsg}</p>
          </div>
        )}
        {replaceError && (
          <div className="card bg-red-50 border-red-200">
            <p className="text-red-800 font-medium">❌ {replaceError}</p>
          </div>
        )}

        {/* Hidden file input for replace */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleReplaceFile}
        />

        {/* Filters */}
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Search</label>
              <input
                type="text"
                placeholder="Name, PAN, year, or filename..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Document Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="input"
              >
                <option value="all">All Types</option>
                <option value="form16_partA">Form 16 - Part A</option>
                <option value="form16_partB">Form 16 - Part B</option>
              </select>
            </div>
          </div>
        </div>

        {/* Documents Table */}
        <div className="card">
          {!filtered || filtered.length === 0 ? (
            <EmptyState
              icon="📁"
              title="No documents found"
              description="Upload documents through the Import Center."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>PAN</th>
                    <th>Type</th>
                    <th>Year</th>
                    <th>Filename</th>
                    <th>Size</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((doc) => (
                    <tr key={doc._id}>
                      <td className="font-medium">{doc.employee_name ?? '—'}</td>
                      <td className="font-mono text-xs">{doc.employee_pan ?? '—'}</td>
                      <td>
                        <span className="badge badge-info">
                          {doc.document_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>{doc.financial_year}</td>
                      <td className="text-xs text-gray-600 max-w-[160px] truncate" title={doc.file_name}>
                        {doc.file_name}
                      </td>
                      <td className="text-xs text-gray-500">
                        {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : '—'}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            doc.review_status === 'approved'
                              ? 'badge-success'
                              : doc.review_status === 'rejected'
                              ? 'badge-danger'
                              : 'badge-warning'
                          }`}
                        >
                          {doc.review_status}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Preview */}
                          <a
                            href={previewUrl(doc._id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            title="Preview PDF"
                          >
                            👁️
                          </a>

                          {/* Download */}
                          <a
                            href={downloadUrl(doc._id)}
                            className="text-green-600 hover:text-green-800 text-sm font-medium"
                            title="Download PDF"
                          >
                            📥
                          </a>

                          {/* Replace */}
                          <button
                            onClick={() => {
                              setReplacingId(doc._id);
                              setReplaceError(null);
                              setTimeout(() => fileInputRef.current?.click(), 50);
                            }}
                            disabled={replaceDoc.isPending && replacingId === doc._id}
                            className="text-yellow-600 hover:text-yellow-800 text-sm font-medium disabled:opacity-50"
                            title="Replace PDF"
                          >
                            {replaceDoc.isPending && replacingId === doc._id ? '⏳' : '🔄'}
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setConfirmDelete(doc._id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                            title="Delete document"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-sm text-gray-600">Total</p>
            <p className="text-2xl font-bold text-gray-900">{documents?.length ?? 0}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Form 16</p>
            <p className="text-2xl font-bold text-gray-900">
              {documents?.filter((d) => d.document_type === 'form16_partA' || d.document_type === 'form16_partB').length ?? 0}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Approved</p>
            <p className="text-2xl font-bold text-green-600">
              {documents?.filter((d) => d.review_status === 'approved').length ?? 0}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">
              {documents?.filter((d) => d.review_status === 'pending').length ?? 0}
            </p>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Document</h3>
            <p className="text-gray-600 mb-6">
              This will permanently delete the document and its PDF file. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deleteDoc.isPending}
                className="btn-danger flex-1"
              >
                {deleteDoc.isPending ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
