import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import { useEmployees } from '@/hooks/useEmployees';
import { useDeleteEmployee } from '@/hooks/useEmployees';
import { useNavigate } from '@tanstack/react-router';
import { api } from '@/lib/api';

export function AdminEmployees() {
  const { data: employees, isLoading, error, refetch } = useEmployees();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteMessage, setBulkDeleteMessage] = useState('');
  const deleteEmployeeMutation = useDeleteEmployee();

  const filteredEmployees = employees?.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.pan.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleEmployeeSelection = (employeeId: string) => {
    const newSelected = new Set(selectedEmployees);
    if (newSelected.has(employeeId)) {
      newSelected.delete(employeeId);
    } else {
      newSelected.add(employeeId);
    }
    setSelectedEmployees(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedEmployees.size === employees?.length) {
      setSelectedEmployees(new Set());
    } else {
      const allIds = new Set(employees?.map(emp => emp._id) || []);
      setSelectedEmployees(allIds);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEmployees.size === 0) {
      alert('Please select at least one employee to delete');
      return;
    }

    const confirmMessage = `Delete ${selectedEmployees.size} employee(s)? This will remove all associated documents and data. This action cannot be undone.`;
    if (!confirm(confirmMessage)) return;

    setIsBulkDeleting(true);
    setBulkDeleteMessage('');

    try {
      const { data } = await api.post('/employees/bulk/delete', {
        employeeIds: Array.from(selectedEmployees)
      });
      
      setBulkDeleteMessage(`✅ ${data.message}`);
      setSelectedEmployees(new Set());
      setTimeout(() => {
        refetch();
        setBulkDeleteMessage('');
      }, 2000);
    } catch (error: any) {
      const message = error?.response?.data?.error || 
                      error?.message || 
                      'Failed to bulk delete employees';
      setBulkDeleteMessage(`❌ ${message}`);
      setTimeout(() => setBulkDeleteMessage(''), 3000);
      console.error('Bulk delete error:', error);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  if (isLoading) return <Layout><LoadingSpinner /></Layout>;
  if (error) return <Layout><ErrorMessage message="Failed to load employees" /></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
            <p className="text-gray-600 mt-1">
              {selectedEmployees.size > 0 
                ? `${selectedEmployees.size} of ${employees?.length || 0} selected for deletion` 
                : `Total: ${employees?.length || 0} employees (${filteredEmployees?.length || 0} shown)`}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="card">
          <input
            type="text"
            placeholder="Search by name, PAN, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input"
          />
        </div>

        {/* Bulk Delete Section */}
        {selectedEmployees.size > 0 && (
          <div className="card bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-red-900">
                  {selectedEmployees.size} employee(s) selected
                </p>
                <p className="text-sm text-red-700 mt-1">
                  Selected employees and all their documents will be permanently deleted
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedEmployees(new Set())}
                  className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 hover:bg-red-50 rounded-lg transition-colors"
                  disabled={isBulkDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={isBulkDeleting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-lg transition-colors"
                >
                  {isBulkDeleting ? 'Deleting...' : `Delete ${selectedEmployees.size}`}
                </button>
              </div>
            </div>
            {bulkDeleteMessage && (
              <p className={`text-sm mt-3 font-medium ${bulkDeleteMessage.startsWith('✅') ? 'text-green-700' : 'text-red-700'}`}>
                {bulkDeleteMessage}
              </p>
            )}
          </div>
        )}

        {/* Employees Table */}
        <div className="card">
          {!filteredEmployees || filteredEmployees.length === 0 ? (
            <EmptyState
              icon="👥"
              title="No employees found"
              description="Employees will be automatically created when Form-16 documents are imported."
            />
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedEmployees.size === employees?.length && employees?.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4"
                          title={selectedEmployees.size > 0 ? `${selectedEmployees.size} of ${employees?.length} selected` : 'Select all employees'}
                        />
                      </th>
                      <th>Name</th>
                      <th>PAN</th>
                      <th>Department</th>
                      <th>Designation</th>
                      <th>Employer</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((employee) => (
                      <tr key={employee._id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedEmployees.has(employee._id)}
                            onChange={() => toggleEmployeeSelection(employee._id)}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="font-medium">{employee.name}</td>
                        <td className="font-mono text-xs">{employee.pan}</td>
                        <td>{employee.department || '-'}</td>
                        <td>{employee.designation || '-'}</td>
                        <td>{employee.employer_name || '-'}</td>
                        <td>{new Date(employee.created_at).toLocaleDateString()}</td>
                        <td className="space-x-2">
                          <button
                            onClick={() => navigate({ to: '/admin/documents' })}
                            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                          >
                            View Documents
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Delete employee ${employee.name}? This will remove documents and data.`)) return;
                              try {
                                await deleteEmployeeMutation.mutateAsync(employee._id);
                              } catch (e) {
                                alert('Failed to delete employee');
                              }
                            }}
                            className="text-red-600 hover:text-red-700 text-sm font-medium"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden space-y-4">
                {filteredEmployees.map((employee) => (
                  <div key={employee._id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex gap-3 items-start flex-1">
                        <input
                          type="checkbox"
                          checked={selectedEmployees.has(employee._id)}
                          onChange={() => toggleEmployeeSelection(employee._id)}
                          className="w-4 h-4 mt-1"
                        />
                        <div>
                          <p className="font-medium text-gray-900">{employee.name}</p>
                          <p className="text-xs text-gray-500 font-mono">{employee.pan}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(employee.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="space-y-1 text-sm">
                      {employee.department && (
                        <p className="text-gray-700">
                          <span className="text-gray-500">Dept:</span> {employee.department}
                        </p>
                      )}
                      {employee.designation && (
                        <p className="text-gray-700">
                          <span className="text-gray-500">Role:</span> {employee.designation}
                        </p>
                      )}
                      {employee.employer_name && (
                        <p className="text-gray-700">
                          <span className="text-gray-500">Employer:</span> {employee.employer_name}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-gray-200">
                      <button
                        onClick={() => navigate({ to: '/admin/documents' })}
                        className="flex-1 min-h-[40px] px-3 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
                      >
                        View Docs
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete employee ${employee.name}? This will remove documents and data.`)) return;
                          try {
                            await deleteEmployeeMutation.mutateAsync(employee._id);
                          } catch (e) {
                            alert('Failed to delete employee');
                          }
                        }}
                        className="flex-1 min-h-[40px] px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card">
            <p className="text-sm text-gray-600">Total Employees</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {employees?.length || 0}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">With Documents</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {employees?.length || 0}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Active This Year</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {employees?.length || 0}
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
