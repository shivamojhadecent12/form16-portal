import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AuditLog } from '@/types';

export function AdminAuditLogs() {
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');

  const { data: logs, isLoading, error } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/audit-logs');
      return data as AuditLog[];
    },
  });

  const filteredLogs = logs?.filter((log) => {
    const matchesAction = filterAction === 'all' || log.action.includes(filterAction);
    const matchesRole = filterRole === 'all' || log.user_role === filterRole;
    return matchesAction && matchesRole;
  });

  if (isLoading) return <Layout><LoadingSpinner /></Layout>;
  if (error) return <Layout><ErrorMessage message="Failed to load audit logs" /></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-600 mt-1">System activity and security logs</p>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Filter by Action</label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="input"
              >
                <option value="all">All Actions</option>
                <option value="login">Login</option>
                <option value="logout">Logout</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="upload">Upload</option>
                <option value="download">Download</option>
              </select>
            </div>
            <div>
              <label className="label">Filter by Role</label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="input"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="employee">Employee</option>
              </select>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="card">
          {!filteredLogs || filteredLogs.length === 0 ? (
            <EmptyState
              icon="📋"
              title="No audit logs found"
              description="No logs match your filters."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User Role</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>IP Address</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log._id}>
                      <td className="text-xs">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            log.user_role === 'admin' ? 'badge-danger' : 'badge-info'
                          }`}
                        >
                          {log.user_role}
                        </span>
                      </td>
                      <td className="font-medium">{log.action}</td>
                      <td>
                        <div className="text-sm">
                          <p className="font-medium">{log.resource_type}</p>
                          {log.resource_id && (
                            <p className="text-xs text-gray-500 font-mono">
                              {log.resource_id.substring(0, 8)}...
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="text-xs font-mono">{log.ip_address || '-'}</td>
                      <td>
                        {log.details && (
                          <button
                            onClick={() => alert(JSON.stringify(log.details, null, 2))}
                            className="text-primary-600 hover:text-primary-700 text-xs"
                          >
                            View
                          </button>
                        )}
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
            <p className="text-sm text-gray-600">Total Logs</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{logs?.length || 0}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Admin Actions</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {logs?.filter((l) => l.user_role === 'admin').length || 0}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Employee Actions</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {logs?.filter((l) => l.user_role === 'employee').length || 0}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Today</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {logs?.filter(
                (l) =>
                  new Date(l.created_at).toDateString() === new Date().toDateString()
              ).length || 0}
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="card bg-yellow-50 border-yellow-200">
          <h3 className="font-semibold text-yellow-900 mb-2">🔒 Security Notice</h3>
          <p className="text-sm text-yellow-800">
            Audit logs are retained for compliance and security purposes. All user actions are
            logged with timestamps, IP addresses, and user agents. Logs cannot be deleted or
            modified.
          </p>
        </div>
      </div>
    </Layout>
  );
}
