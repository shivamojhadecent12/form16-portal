import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { useDocuments } from '@/hooks/useDocuments';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';

export function EmployeeDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { data: documents, isLoading, error } = useDocuments(user?.id);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');

  useEffect(() => {
    const handleStorageChange = () => setIsDarkMode(localStorage.getItem('darkMode') === 'true');
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const form16Count = documents?.filter((d) => d.document_type === 'form16_partA' || d.document_type === 'form16_partB').length || 0;
  const salarySlipCount = documents?.filter((d) => d.document_type === 'salary_slip').length || 0;
  const otherCount = documents?.length ? documents.length - form16Count - salarySlipCount : 0;

  if (isLoading) return <Layout><LoadingSpinner /></Layout>;
  if (error) return <Layout><ErrorMessage message="Failed to load dashboard" /></Layout>;

  const StatCard = ({ icon, label, value, color, gradient }: any) => (
    <div className={`group relative overflow-hidden rounded-2xl p-6 md:p-8 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 cursor-pointer ${
      isDarkMode ? 'bg-gray-800 border border-gray-700' : `bg-white border border-${color}-200`
    }`}>
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${gradient}`}></div>
      <div className="relative z-10">
        <div className={`text-5xl md:text-6xl mb-4 transform group-hover:scale-125 transition-transform duration-300`}>
          {icon}
        </div>
        <p className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {label}
        </p>
        <p className={`text-4xl md:text-5xl font-black mt-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          {value}
        </p>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="space-y-8 pb-8">
        {/* Hero Section */}
        <div className={`relative rounded-3xl overflow-hidden p-8 md:p-12 ${isDarkMode ? 'bg-gradient-to-br from-blue-900 to-indigo-900' : 'bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600'}`}>
          <div className="absolute top-0 right-0 w-96 h-96 opacity-10">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="50" cy="50" r="40" fill="currentColor" />
            </svg>
          </div>
          <div className="relative z-10">
            <h1 className="text-4xl md:text-5xl font-black text-white mb-3">
              Welcome back, {user?.name}! 👋
            </h1>
            <p className="text-xl text-blue-100 max-w-2xl">
              Access your Form 16 documents, compare salary trends, and manage your financial records securely with SSB Form 16 Portal.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div>
          <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            📊 Your Document Summary
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            <StatCard 
              icon="📋"
              label="Form 16 Documents"
              value={form16Count}
              color="blue"
              gradient="bg-gradient-to-br from-blue-400/20 to-blue-600/20"
            />
            <StatCard 
              icon="💰"
              label="Salary Slips"
              value={salarySlipCount}
              color="green"
              gradient="bg-gradient-to-br from-green-400/20 to-green-600/20"
            />
            <StatCard 
              icon="📎"
              label="Other Documents"
              value={otherCount}
              color="purple"
              gradient="bg-gradient-to-br from-purple-400/20 to-purple-600/20"
            />
          </div>
        </div>

        {/* Recent Documents */}
        <div className={`rounded-3xl overflow-hidden ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <div className={`px-6 md:px-8 py-6 border-b ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50'}`}>
            <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              📄 Recent Documents
            </h2>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Your latest Form 16 and related documents
            </p>
          </div>

          <div className="p-6 md:p-8">
            {!documents || documents.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">�</div>
                <p className={`text-lg font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  No documents available yet
                </p>
                <p className={`text-sm mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  Documents will appear here once uploaded by administrator
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {documents.slice(0, 6).map((doc) => (
                  <button
                    key={doc._id}
                    onClick={() => navigate({ to: `/employee/documents/${doc._id}` })}
                    className={`group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                      isDarkMode 
                        ? 'bg-gray-700 hover:bg-gray-600 border border-gray-600' 
                        : 'bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                        doc.document_type === 'form16_partA' 
                          ? isDarkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-200 text-blue-900'
                          : doc.document_type === 'form16_partB'
                          ? isDarkMode ? 'bg-indigo-900 text-indigo-200' : 'bg-indigo-200 text-indigo-900'
                          : isDarkMode ? 'bg-purple-900 text-purple-200' : 'bg-purple-200 text-purple-900'
                      }`}>
                        {doc.document_type === 'form16_partA' 
                          ? 'Form 16 - Part A'
                          : doc.document_type === 'form16_partB'
                          ? 'Form 16 - Part B'
                          : doc.document_type.replace(/_/g, ' ')}
                      </span>
                      <span className={`text-2xl ${isDarkMode ? 'group-hover:scale-125 text-blue-400' : 'group-hover:scale-125 text-blue-600'} transition-transform`}>
                        📄
                      </span>
                    </div>
                    <p className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {doc.financial_year}
                    </p>
                    <p className={`text-sm mt-2 truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {doc.file_name}
                    </p>
                    <p className={`text-xs mt-3 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      📅 {new Date(doc.uploaded_at).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            ⚡ Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <button
              onClick={() => navigate({ to: '/employee/documents' })}
              className={`group relative overflow-hidden rounded-2xl p-8 text-center transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 ${
                isDarkMode
                  ? 'bg-gradient-to-br from-blue-900 to-blue-800 border border-blue-700'
                  : 'bg-gradient-to-br from-blue-500 to-blue-600 border border-blue-400'
              }`}
            >
              <div className="relative z-10">
                <div className="text-5xl mb-3 transform group-hover:scale-125 transition-transform">�</div>
                <h3 className="text-xl font-bold text-white mb-1">All Documents</h3>
                <p className="text-blue-100 text-sm">Browse complete document collection</p>
              </div>
            </button>

            <button
              onClick={() => navigate({ to: '/employee/comparison' })}
              className={`group relative overflow-hidden rounded-2xl p-8 text-center transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 ${
                isDarkMode
                  ? 'bg-gradient-to-br from-indigo-900 to-indigo-800 border border-indigo-700'
                  : 'bg-gradient-to-br from-indigo-500 to-indigo-600 border border-indigo-400'
              }`}
            >
              <div className="relative z-10">
                <div className="text-5xl mb-3 transform group-hover:scale-125 transition-transform">📈</div>
                <h3 className="text-xl font-bold text-white mb-1">Year Comparison</h3>
                <p className="text-indigo-100 text-sm">Analyze your salary trends</p>
              </div>
            </button>
          </div>
        </div>

        {/* Employee Info Card */}
        <div className={`rounded-3xl overflow-hidden ${isDarkMode ? 'bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700' : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border border-blue-200'}`}>
          <div className="p-8 md:p-12">
            <h3 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              🆔 Your Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-blue-700'}`}>
                  Full Name
                </p>
                <p className={`text-xl font-bold mt-2 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  {user?.name}
                </p>
              </div>
              <div>
                <p className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-blue-700'}`}>
                  PAN Number
                </p>
                <p className={`text-xl font-mono font-bold mt-2 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  {user?.pan}
                </p>
              </div>
              <div>
                <p className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-blue-700'}`}>
                  Role
                </p>
                <p className={`text-xl font-bold mt-2 ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>
                  👤 Employee
                </p>
              </div>
              <div>
                <p className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-blue-700'}`}>
                  Portal
                </p>
                <p className={`text-xl font-bold mt-2 ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>
                  🏛️ SSB Form 16 Portal
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
