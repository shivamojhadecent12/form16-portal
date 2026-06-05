import { useParams } from '@tanstack/react-router';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import {
  useDocument,
  useDocumentMetadata,
  useDocumentAnalysis,
  useDocumentUrls,
} from '@/hooks/useDocuments';
import { api } from '@/lib/api';
import { useEffect, useState } from 'react';

export function EmployeeDocumentViewer() {
  const { id } = useParams({ from: '/employee/documents/$id' });
  const { data: document, isLoading: docLoading, error: docError } = useDocument(id);
  const { data: metadata, isLoading: metaLoading } = useDocumentMetadata(id);
  const { data: analysis, isLoading: analysisLoading } = useDocumentAnalysis(id);
  const { data: urls, isLoading: urlLoading } = useDocumentUrls(id);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Debug logging
  useEffect(() => {
    if (docError) {
      console.error('Document fetch error:', docError);
    }
  }, [docError]);

  // If the preview URL uses a token query param but token is missing, fetch via authenticated XHR
  useEffect(() => {
    let mounted = true;
    async function fetchPreview() {
      try {
        const token = localStorage.getItem('auth_token') ?? '';
        if (token) return; // no need — preview link will work with token
        // fetch authenticated blob and create object URL
        const resp = await api.get(`/documents/${id}/preview`, { responseType: 'blob' });
        const url = URL.createObjectURL(resp.data);
        if (mounted) setBlobUrl(url);
      } catch (e) {
        console.warn('Authenticated preview fetch failed', e);
        if (mounted) setBlobUrl(null);
      }
    }
    if (id) fetchPreview();
    return () => {
      mounted = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [id]);

  if (docLoading) return <Layout><LoadingSpinner /></Layout>;
  if (docError) return <Layout><ErrorMessage message={`Failed to load document: ${docError instanceof Error ? docError.message : 'Unknown error'}`} /></Layout>;
  if (!document) return <Layout><ErrorMessage message="Document not found" /></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Document Viewer</h1>
          <p className="text-gray-600 mt-1">{document.file_name}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Document Info */}
          <div className="lg:col-span-1 space-y-6">
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-4">Document Details</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-600">Type</p>
                  <span className="badge badge-info mt-1">
                    {document.document_type.replace(/_/g, ' ')}
                  </span>
                </div>
                <div>
                  <p className="text-gray-600">Financial Year</p>
                  <p className="font-medium text-gray-900">{document.financial_year}</p>
                </div>
                <div>
                  <p className="text-gray-600">Uploaded</p>
                  <p className="font-medium text-gray-900">
                    {new Date(document.uploaded_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">File Size</p>
                  <p className="font-medium text-gray-900">
                    {document.file_size
                      ? `${(document.file_size / 1024).toFixed(1)} KB`
                      : 'N/A'}
                  </p>
                </div>
              </div>

              {!urlLoading && (urls || blobUrl) && (
                <div className="space-y-2 mt-4">
                  <button
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem('auth_token') ?? '';
                        if (token) {
                          // let browser handle via URL with token param
                          const link = urls?.download || '';
                          window.location.href = link;
                          return;
                        }
                        // fetch via authenticated XHR and trigger download
                        const resp = await api.get(`/documents/${id}/download`, { responseType: 'blob' });
                        const url = URL.createObjectURL(resp.data);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = document.file_name || 'document.pdf';
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                      } catch (e) {
                        alert('Download failed');
                      }
                    }}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-lg transition-colors min-h-[44px] flex items-center justify-center gap-2"
                  >
                    📥 Download PDF
                  </button>
                  <a
                    href={blobUrl || (urls ? urls.preview : '')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-colors block text-center min-h-[44px] flex items-center justify-center gap-2"
                  >
                    👁️ Open in New Tab
                  </a>
                </div>
              )}
            </div>

            {/* AI Analysis Summary */}
            {analysisLoading ? (
              <div className="card"><LoadingSpinner /></div>
            ) : analysis ? (
              <div className="card">
                <h2 className="font-semibold text-gray-900 mb-4">AI Analysis</h2>

                {analysis.salary_summary && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Salary Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Gross Salary</span>
                        <span className="font-medium">
                          ₹{analysis.salary_summary.gross_salary?.toLocaleString() ?? '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {analysis.tax_summary && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Tax Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Tax</span>
                        <span className="font-medium">
                          ₹{analysis.tax_summary.total_tax?.toLocaleString() ?? '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">TDS</span>
                        <span className="font-medium">
                          ₹{analysis.tax_summary.tds?.toLocaleString() ?? '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Net Tax Payable</span>
                        <span className="font-medium">
                          ₹{analysis.tax_summary.refund_or_payable?.toLocaleString() ?? '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {analysis.employee_explanation && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-900">{analysis.employee_explanation}</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Document Preview */}
          <div className="lg:col-span-2">
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-4">Document Preview</h2>

              {urlLoading ? (
                <LoadingSpinner />
              ) : (blobUrl || urls) ? (
                <iframe
                  src={blobUrl || (urls ? urls.preview : '')}
                  className="w-full h-[800px] border border-gray-200 rounded"
                  title="Document Preview"
                />
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">Unable to load document preview (login required)</p>
                </div>
              )}
            </div>

            {/* Extracted Data */}
            {metaLoading ? (
              <div className="card mt-6"><LoadingSpinner /></div>
            ) : metadata?.parsed_json ? (
              <div className="card mt-6">
                <h2 className="font-semibold text-gray-900 mb-4">Extracted Information</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {Object.entries(metadata.parsed_json as Record<string, unknown>)
                    .filter(([, value]) => value !== null && typeof value !== 'object')
                    .map(([key, value]) => (
                      <div key={key}>
                        <p className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}</p>
                        <p className="font-medium text-gray-900">
                          {typeof value === 'number'
                            ? `₹${(value as number).toLocaleString()}`
                            : String(value)}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Layout>
  );
}
