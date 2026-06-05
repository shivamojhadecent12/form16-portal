import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import { useDocuments } from '@/hooks/useDocuments';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';

interface DocumentGroup {
  year: string;
  partA?: any;
  partB?: any;
}

export function EmployeeDocuments() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { data: documents, isLoading, error } = useDocuments(user?.id);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');

  useEffect(() => {
    const handleStorageChange = () => setIsDarkMode(localStorage.getItem('darkMode') === 'true');
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Group documents by year and part
  const groupedDocuments = documents?.reduce((acc: Record<string, DocumentGroup>, doc) => {
    const year = doc.financial_year || 'unknown';
    if (!acc[year]) {
      acc[year] = { year };
    }
    
    if (doc.document_type === 'form16_partA') {
      acc[year].partA = doc;
    } else if (doc.document_type === 'form16_partB') {
      acc[year].partB = doc;
    }
    
    return acc;
  }, {});

  const sortedYears = Object.keys(groupedDocuments || {}).sort((a, b) => b.localeCompare(a));

  const handleDownload = (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    navigate({ to: `/employee/documents/${docId}` });
  };

  if (isLoading) return <Layout><LoadingSpinner /></Layout>;
  if (error) return <Layout><ErrorMessage message="Failed to load documents" /></Layout>;

  const StatCard = ({ icon, label, value, color }: { icon: string; label: string; value: number; color: 'blue' | 'green' | 'purple' }) => {
    const bgClasses: Record<'blue' | 'green' | 'purple', string> = {
      blue: isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200',
      green: isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gradient-to-br from-green-50 to-green-100 border border-green-200',
      purple: isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200',
    };
    const textClasses: Record<'blue' | 'green' | 'purple', string> = {
      blue: isDarkMode ? 'text-gray-400' : 'text-blue-700',
      green: isDarkMode ? 'text-gray-400' : 'text-green-700',
      purple: isDarkMode ? 'text-gray-400' : 'text-purple-700',
    };
    const valueClasses: Record<'blue' | 'green' | 'purple', string> = {
      blue: isDarkMode ? 'text-white' : 'text-blue-900',
      green: isDarkMode ? 'text-white' : 'text-green-900',
      purple: isDarkMode ? 'text-white' : 'text-purple-900',
    };

    return (
      <div className={`rounded-2xl p-6 md:p-8 ${bgClasses[color]}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm font-bold uppercase tracking-wider ${textClasses[color]}`}>
              {label}
            </p>
            <p className={`text-4xl font-black mt-3 ${valueClasses[color]}`}>
              {value}
            </p>
          </div>
          <div className="text-5xl">{icon}</div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-8 pb-8">
        {/* Header */}
        <div className={`rounded-3xl overflow-hidden p-8 md:p-12 ${isDarkMode ? 'bg-gradient-to-br from-blue-900 to-indigo-900' : 'bg-gradient-to-br from-blue-500 to-indigo-600'}`}>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3">
            📄 My Documents
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl">
            Access all your Form 16 documents organized by financial year
          </p>
        </div>

        {/* Summary Stats */}
        <div>
          <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            📊 Document Summary
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            <StatCard 
              icon="📋"
              label="Total Documents"
              value={documents?.length || 0}
              color="blue"
            />
            <StatCard 
              icon="📑"
              label="Form 16 - Part A"
              value={documents?.filter((d) => d.document_type === 'form16_partA').length || 0}
              color="green"
            />
            <StatCard 
              icon="📄"
              label="Form 16 - Part B"
              value={documents?.filter((d) => d.document_type === 'form16_partB').length || 0}
              color="purple"
            />
          </div>
        </div>

        {/* Documents by Year */}
        <div>
          {!documents || documents.length === 0 ? (
            <div className={`rounded-3xl overflow-hidden p-12 ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
              <EmptyState
                icon="📄"
                title="No documents found"
                description="You don't have any Form 16 documents yet. Documents will appear here once uploaded."
              />
            </div>
          ) : (
            <div className="space-y-8">
              {sortedYears.map((year) => {
                const group = groupedDocuments![year];
                return (
                  <div key={year} className="space-y-4">
                    <div className={`inline-block px-6 py-3 rounded-full font-black text-lg ${isDarkMode ? 'bg-gradient-to-r from-blue-900 to-indigo-900 text-blue-200' : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'}`}>
                      📅 Financial Year {year}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Part A Card */}
                      {group.partA ? (
                        <button
                          onClick={(e) => handleDownload(e, group.partA._id)}
                          className={`group relative overflow-hidden rounded-2xl p-6 md:p-8 text-left transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 ${
                            isDarkMode 
                              ? 'bg-gray-800 border border-gray-700 hover:bg-gray-700' 
                              : 'bg-gradient-to-br from-blue-50 via-white to-blue-50 hover:from-blue-100 hover:to-blue-100 border border-blue-200'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <span className={`px-4 py-2 rounded-full font-bold text-sm uppercase tracking-wider ${isDarkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-200 text-blue-900'}`}>
                              Part A
                            </span>
                            <span className="text-4xl group-hover:scale-125 transition-transform">�</span>
                          </div>
                          <h3 className={`font-bold text-lg mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            Form 16 - Part A
                          </h3>
                          <p className={`text-sm mb-4 truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {group.partA.file_name}
                          </p>
                          <div className="flex items-center justify-between pt-4 border-t border-current border-opacity-10">
                            <span className={`text-xs font-semibold ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                              📅 {new Date(group.partA.uploaded_at).toLocaleDateString()}
                            </span>
                            <span className={`text-sm font-bold group-hover:translate-x-2 transition-transform ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                              View →
                            </span>
                          </div>
                        </button>
                      ) : (
                        <div className={`rounded-2xl p-6 md:p-8 opacity-50 ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gray-100 border border-gray-300'}`}>
                          <div className="flex items-start justify-between mb-4">
                            <span className={`px-4 py-2 rounded-full font-bold text-sm uppercase tracking-wider ${isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-300 text-gray-600'}`}>
                              Part A
                            </span>
                            <span className="text-3xl">❌</span>
                          </div>
                          <h3 className={`font-bold text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Form 16 - Part A
                          </h3>
                          <p className={`text-sm mt-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                            Not available
                          </p>
                        </div>
                      )}

                      {/* Part B Card */}
                      {group.partB ? (
                        <button
                          onClick={(e) => handleDownload(e, group.partB._id)}
                          className={`group relative overflow-hidden rounded-2xl p-6 md:p-8 text-left transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 ${
                            isDarkMode 
                              ? 'bg-gray-800 border border-gray-700 hover:bg-gray-700' 
                              : 'bg-gradient-to-br from-green-50 via-white to-green-50 hover:from-green-100 hover:to-green-100 border border-green-200'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <span className={`px-4 py-2 rounded-full font-bold text-sm uppercase tracking-wider ${isDarkMode ? 'bg-green-900 text-green-200' : 'bg-green-200 text-green-900'}`}>
                              Part B
                            </span>
                            <span className="text-4xl group-hover:scale-125 transition-transform">📄</span>
                          </div>
                          <h3 className={`font-bold text-lg mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            Form 16 - Part B
                          </h3>
                          <p className={`text-sm mb-4 truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {group.partB.file_name}
                          </p>
                          <div className="flex items-center justify-between pt-4 border-t border-current border-opacity-10">
                            <span className={`text-xs font-semibold ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                              📅 {new Date(group.partB.uploaded_at).toLocaleDateString()}
                            </span>
                            <span className={`text-sm font-bold group-hover:translate-x-2 transition-transform ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                              View →
                            </span>
                          </div>
                        </button>
                      ) : (
                        <div className={`rounded-2xl p-6 md:p-8 opacity-50 ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gray-100 border border-gray-300'}`}>
                          <div className="flex items-start justify-between mb-4">
                            <span className={`px-4 py-2 rounded-full font-bold text-sm uppercase tracking-wider ${isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-300 text-gray-600'}`}>
                              Part B
                            </span>
                            <span className="text-3xl">❌</span>
                          </div>
                          <h3 className={`font-bold text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Form 16 - Part B
                          </h3>
                          <p className={`text-sm mt-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                            Not available
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
