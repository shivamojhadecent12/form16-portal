import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function AdminSettings() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/settings');
      return data;
    },
  });

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { data } = await api.put(`/dashboard/settings/${key}`, { value });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setMessage('Settings saved successfully');
      setTimeout(() => setMessage(''), 3000);
    },
  });

  const handleSave = async (key: string, value: any) => {
    try {
      await updateSetting.mutateAsync({ key, value });
    } catch (err) {
      setMessage('Failed to save settings');
    }
  };

  if (isLoading) return <Layout><LoadingSpinner /></Layout>;
  if (error) return <Layout><ErrorMessage message="Failed to load settings" /></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Configure system settings</p>
        </div>

        {message && (
          <div className="card bg-green-50 border-green-200">
            <p className="text-green-800">{message}</p>
          </div>
        )}

        {/* OpenRouter API Key */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Configuration</h2>
          
          <div className="space-y-4">
            <div>
              <label className="label">OpenRouter API Key</label>
              <input
                type="password"
                defaultValue={settings?.find((s: any) => s.key === 'openrouter_api_key')?.value || ''}
                onBlur={(e) => handleSave('openrouter_api_key', e.target.value)}
                className="input"
                placeholder="sk-or-..."
              />
              <p className="text-sm text-gray-500 mt-1">
                Required for AI document analysis and chat features
              </p>
            </div>

            <div>
              <label className="label">Enable AI Analysis</label>
              <select
                defaultValue={
                  settings?.find((s: any) => s.key === 'enable_ai_analysis')?.value ? 'true' : 'false'
                }
                onChange={(e) => handleSave('enable_ai_analysis', e.target.value === 'true')}
                className="input"
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
              <p className="text-sm text-gray-500 mt-1">
                Enable or disable AI analysis for uploaded documents
              </p>
            </div>
          </div>
        </div>

        {/* Upload Settings */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Configuration</h2>
          
          <div className="space-y-4">
            <div>
              <label className="label">Max File Size (MB)</label>
              <input
                type="number"
                defaultValue={settings?.find((s: any) => s.key === 'max_file_size_mb')?.value || 50}
                onBlur={(e) => handleSave('max_file_size_mb', parseInt(e.target.value))}
                className="input"
                min="1"
                max="100"
              />
              <p className="text-sm text-gray-500 mt-1">
                Maximum file size for document uploads
              </p>
            </div>

            <div>
              <label className="label">Allowed Document Types</label>
              <input
                type="text"
                defaultValue={
                  JSON.stringify(
                    settings?.find((s: any) => s.key === 'allowed_document_types')?.value || []
                  )
                }
                onBlur={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    handleSave('allowed_document_types', parsed);
                  } catch {
                    alert('Invalid JSON format');
                  }
                }}
                className="input"
              />
              <p className="text-sm text-gray-500 mt-1">
                JSON array of allowed MIME types (e.g., ["application/pdf"])
              </p>
            </div>
          </div>
        </div>

        {/* System Information */}
        <div className="card bg-blue-50 border-blue-200">
          <h2 className="text-lg font-semibold text-blue-900 mb-4">System Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-blue-700">Version</p>
              <p className="font-medium text-blue-900">1.0.0</p>
            </div>
            <div>
              <p className="text-blue-700">Database</p>
              <p className="font-medium text-blue-900">MySQL</p>
            </div>
            <div>
              <p className="text-blue-700">Storage</p>
              <p className="font-medium text-blue-900">Local Filesystem</p>
            </div>
            <div>
              <p className="text-blue-700">AI Provider</p>
              <p className="font-medium text-blue-900">OpenRouter</p>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card border-red-200">
          <h2 className="text-lg font-semibold text-red-900 mb-4">Danger Zone</h2>
          
          <div className="space-y-3">
            <button className="btn-danger">
              Clear All Cache
            </button>
            <button className="btn-danger">
              Reset AI Analysis
            </button>
            <button className="btn-danger">
              Export All Data
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
