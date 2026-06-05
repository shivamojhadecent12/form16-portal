import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import { useDocuments } from '@/hooks/useDocuments';
import { useNavigate } from '@tanstack/react-router';

export function AdminDocuments() {
  const { data: documents, isLoading, error } = useDocuments();
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDocuments = documents?.filter((doc) => {
    const matchesType = filterType === 'all' || doc.document_type === filterType;
    const matchesSearch =
      (doc.employee_name ?? doc.employee?.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.employee_pan ?? doc.employee?.pan ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.financial_year.includes(searchTerm);
    return matchesType && matchesSearch;
  });

  if (isLoading) return <Layout><LoadingSpinner /></Layout>;
  if (error) return <Layout><ErrorMessage message="Failed to load documents" /></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-600 mt-1">All uploaded documents</p>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Search</label>
              <input
                type="text"
                placeholder="Search by employee name, PAN, or year..."
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
          {!filteredDocuments || filteredDocuments.length === 0 ? (
            <EmptyState
              icon="📄"
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
                    <th>Document Type</th>
                    <th>Financial Year</th>
                    <th>Status</th>
                    <th>Uploaded</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((doc) => (
                    <tr key={doc._id}>
                      <td className="font-medium">{doc.employee_name ?? doc.employee?.name}</td>
                      <td className="font-mono text-xs">{doc.employee_pan ?? doc.employee?.pan}</td>
                      <td>
                        <span className="badge badge-info">
                          {doc.document_type === 'form16_partA' 
                            ? 'Form 16 - Part A'
                            : doc.document_type === 'form16_partB'
                            ? 'Form 16 - Part B'
                            : doc.document_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>{doc.financial_year}</td>
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
                      <td>{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                      <td>
                        <button
                          onClick={() => navigate({ to: '/admin/manage-files' })}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card">
            <p className="text-sm text-gray-600">Total Documents</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {documents?.length || 0}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Form 16</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {documents?.filter((d) => d.document_type === 'form16_partA' || d.document_type === 'form16_partB').length || 0}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Salary Slips</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {documents?.filter((d) => d.document_type === 'salary_slip').length || 0}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Other Documents</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {documents?.filter(
                (d) =>
                  d.document_type === 'appointment_letter' ||
                  d.document_type === 'promotion_letter'
              ).length || 0}
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
