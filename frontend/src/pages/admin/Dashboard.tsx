import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useDashboardStats } from '@/hooks/useDashboard';
import { useImportJobs } from '@/hooks/useImportJobs';
import { Link } from '@tanstack/react-router';

export function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: jobs, isLoading: jobsLoading } = useImportJobs();

  const recentJobs = jobs?.slice(0, 5) || [];

  if (statsLoading) return <Layout><LoadingSpinner /></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Overview of system activity</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card dark:bg-gray-800 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Employees</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                  {stats?.total_employees || 0}
                </p>
              </div>
              <div className="text-4xl">👥</div>
            </div>
          </div>

          <div className="card dark:bg-gray-800 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Documents</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                  {stats?.total_documents || 0}
                </p>
              </div>
              <div className="text-4xl">📄</div>
            </div>
          </div>

          <div className="card dark:bg-gray-800 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Form 16 - Part A</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">
                  {stats?.form16_partA || 0}
                </p>
              </div>
              <div className="text-4xl">📋</div>
            </div>
          </div>

          <div className="card dark:bg-gray-800 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Form 16 - Part B</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {stats?.form16_partB || 0}
                </p>
              </div>
              <div className="text-4xl">�</div>
            </div>
          </div>
        </div>

        {/* Recent Import Jobs */}
        <div className="card dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Import Jobs</h2>
            <Link to="/admin/import" className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400">
              View All →
            </Link>
          </div>

          {jobsLoading ? (
            <LoadingSpinner />
          ) : recentJobs.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No import jobs yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table dark:bg-gray-800">
                <thead>
                  <tr className="dark:border-gray-700">
                    <th className="dark:text-gray-300">File Name</th>
                    <th className="dark:text-gray-300">Status</th>
                    <th className="dark:text-gray-300">Progress</th>
                    <th className="dark:text-gray-300">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((job: any) => (
                    <tr key={job._id} className="dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="dark:text-gray-300">{job.file_name}</td>
                      <td className="dark:text-gray-300">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          job.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          job.status === 'processing' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                          job.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="dark:text-gray-300">{job.processed_files}/{job.total_files}</td>
                      <td className="dark:text-gray-300 text-sm">{new Date(job.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            to="/admin/import"
            className="card dark:bg-gray-800 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="text-4xl">📥</div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Import Documents</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Upload and process bulk documents</p>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/employees"
            className="card dark:bg-gray-800 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="text-4xl">👥</div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Manage Employees</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">View and manage employee records</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
