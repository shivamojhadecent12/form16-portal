import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { useImportJobs, useCreateImportJob } from '@/hooks/useImportJobs';
import { useAuthStore } from '@/store/authStore';
import { useImportJobLogs } from '@/hooks/useImportJobs';
import type { DocumentType } from '@/types';

export function AdminImport() {
  const { user } = useAuthStore();
  const { data: jobs, isLoading, error } = useImportJobs();
  const createJob = useCreateImportJob();

  const [selectedJobForLogs, setSelectedJobForLogs] = useState<string | null>(null);

  function LogsViewer({ jobId }: { jobId: string }) {
    const { data: logs, isLoading } = useImportJobLogs(jobId);

    if (isLoading) return <div className="py-6 text-center">Loading logs...</div>;
    if (!logs || logs.length === 0) return <div className="py-6 text-center">No logs for this job</div>;

    return (
      <div className="space-y-3 max-h-96 overflow-auto">
        {logs.map((l: any) => (
          <div key={l._id} className="p-3 border rounded bg-gray-50 dark:bg-gray-900">
            <div className="flex justify-between text-sm text-gray-600">
              <div>{l.file_name}</div>
              <div className="font-mono">{new Date(l.created_at).toLocaleString()}</div>
            </div>
            <div className="text-sm mt-2">
              <strong>Status:</strong> {l.status}
            </div>
            {l.error_message && (
              <div className="text-sm text-red-600 mt-1">{l.error_message}</div>
            )}
          </div>
        ))}
      </div>
    );
  }

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>('form16');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/zip' && !file.name.endsWith('.zip')) {
        setUploadError('Please select a ZIP file');
        return;
      }
      setSelectedFile(file);
      setUploadError('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    setUploading(true);
    setUploadError('');

    try {
      await createJob.mutateAsync({
        file: selectedFile,
        documentType,
      });

      setSelectedFile(null);
      setUploadError('');
      alert('Import job created successfully! Processing will begin shortly.');
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) return <Layout><LoadingSpinner /></Layout>;
  if (error) return <Layout><ErrorMessage message="Failed to load import jobs" /></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import Center</h1>
          <p className="text-gray-600 mt-1">Upload ZIP files containing documents</p>
        </div>

        {/* Upload Form */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Documents</h2>

          <div className="space-y-4">
            <div>
              <label className="label">Document Type</label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                className="input"
              >
                <option value="form16">Form 16 (Creates Employees)</option>
                <option value="salary_slip">Salary Slip</option>
                <option value="appointment_letter">Appointment Letter</option>
                <option value="promotion_letter">Promotion Letter</option>
              </select>
              {documentType === 'form16' && (
                <p className="text-sm text-blue-600 mt-2">
                  ℹ️ Form 16 uploads will automatically create employee records
                </p>
              )}
              {documentType !== 'form16' && (
                <p className="text-sm text-yellow-600 mt-2">
                  ⚠️ This document type requires existing employees (matched by PAN)
                </p>
              )}
            </div>

            <div>
              <label className="label">ZIP File</label>
              <input
                type="file"
                accept=".zip,application/zip"
                onChange={handleFileChange}
                className="input"
              />
              {selectedFile && (
                <p className="text-sm text-gray-600 mt-2">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            {uploadError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{uploadError}</p>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Upload and Process'}
            </button>
          </div>
        </div>

        {/* Import Jobs */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Import History</h2>

          {!jobs || jobs.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No import jobs yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Success</th>
                    <th>Failed</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job._id}>
                      <td className="font-medium">{job.file_name}</td>
                      <td>
                        <span className="badge badge-info">
                          {job.document_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            job.status === 'completed'
                              ? 'badge-success'
                              : job.status === 'failed'
                              ? 'badge-danger'
                              : job.status === 'processing'
                              ? 'badge-warning'
                              : 'badge-info'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td>
                        {job.processed_files} / {job.total_files}
                      </td>
                      <td className="text-green-600 font-medium">{job.successful_files}</td>
                      <td className="text-red-600 font-medium">{job.failed_files}</td>
                      <td>{new Date(job.created_at).toLocaleDateString()}</td>
                      <td>
                        <button
                          onClick={() => setSelectedJobForLogs(job._id)}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          View Logs
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Logs Modal */}
        {selectedJobForLogs && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black opacity-40" onClick={() => setSelectedJobForLogs(null)} />
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 z-10 w-11/12 max-w-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Import Job Logs</h3>
                <button onClick={() => setSelectedJobForLogs(null)} className="text-sm text-gray-600">Close</button>
              </div>
              <LogsViewer jobId={selectedJobForLogs} />
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="card bg-blue-50 border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">📋 Import Instructions</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Upload ZIP files containing PDF documents</li>
            <li>Form 16 uploads automatically create employee records</li>
            <li>Other document types require existing employees (matched by PAN)</li>
            <li>Duplicate documents (same PAN + Year + Type) are skipped</li>
            <li>Processing happens in the background</li>
            <li>Check Review Queue for documents needing attention</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}
