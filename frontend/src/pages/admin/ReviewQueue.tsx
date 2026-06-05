import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import { usePendingReviews, useUpdateDocumentReview } from '@/hooks/useDocuments';
import { useAuthStore } from '@/store/authStore';

export function AdminReviewQueue() {
  const { user } = useAuthStore();
  const { data: documents, isLoading, error } = usePendingReviews();
  const updateReview = useUpdateDocumentReview();

  const handleApprove = async (documentId: string) => {
    if (!user) return;
    try {
      await updateReview.mutateAsync({
        id: documentId,
        status: 'approved',
      });
      alert('Document approved successfully');
    } catch (err) {
      alert('Failed to approve document');
    }
  };

  const handleReject = async (documentId: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to reject this document?')) return;

    try {
      await updateReview.mutateAsync({
        id: documentId,
        status: 'rejected',
      });
      alert('Document rejected');
    } catch (err) {
      alert('Failed to reject document');
    }
  };

  if (isLoading) return <Layout><LoadingSpinner /></Layout>;
  if (error) return <Layout><ErrorMessage message="Failed to load review queue" /></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
          <p className="text-gray-600 mt-1">Documents requiring review</p>
        </div>

        <div className="card">
          {!documents || documents.length === 0 ? (
            <EmptyState
              icon="✅"
              title="No documents pending review"
              description="All documents have been reviewed."
            />
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => (
                <div key={doc._id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">
                          {doc.employee?.name}
                        </h3>
                        <span className="badge badge-info">
                          {doc.document_type.replace('_', ' ')}
                        </span>
                        <span className="badge badge-warning">Pending Review</span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">PAN</p>
                          <p className="font-mono font-medium">{doc.employee?.pan}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Financial Year</p>
                          <p className="font-medium">{doc.financial_year}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">File Name</p>
                          <p className="font-medium">{doc.file_name}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Uploaded</p>
                          <p className="font-medium">
                            {new Date(doc.uploaded_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <p className="text-sm text-yellow-800">
                          ⚠️ This document requires manual review. Please verify the extracted
                          data before approving.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleApprove(doc._id)}
                        disabled={updateReview.isPending}
                        className="btn-primary text-sm disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(doc._id)}
                        disabled={updateReview.isPending}
                        className="btn-danger text-sm disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card">
            <p className="text-sm text-gray-600">Pending Reviews</p>
            <p className="text-2xl font-bold text-yellow-600 mt-2">
              {documents?.length || 0}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Avg Review Time</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">2.5 hrs</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Reviewed Today</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">0</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
