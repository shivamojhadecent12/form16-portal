import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';

export function AdminLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  // Admin form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    localStorage.setItem('darkMode', isDarkMode.toString());
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login/admin', {
        email,
        password,
      });

      const { user, token } = response.data;
      
      // Save token (must use auth_token for API interceptor)
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));
      
      setUser(user);
      navigate({ to: '/admin' });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen transition-colors ${isDarkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-blue-100'} flex items-center justify-center p-4`}>
      <div className="absolute top-4 right-4">
        {/* Dark Mode Toggle */}
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-gray-800 text-yellow-400' : 'bg-white text-gray-800'}`}
          title="Toggle dark mode"
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>
      </div>

      <div className={`w-full max-w-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl p-8`}>
        <div className="text-center mb-8">
          <h1 className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
            🔐 Admin Portal
          </h1>
          <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            SSB Form 16 Management
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`label ${isDarkMode ? 'text-gray-300' : ''}`}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`input ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : ''}`}
              placeholder="admin@ssb.gov.in"
              required
            />
          </div>

          <div>
            <label className={`label ${isDarkMode ? 'text-gray-300' : ''}`}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`input ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : ''}`}
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Logging in...' : 'Admin Login'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t" style={{ borderTopColor: isDarkMode ? '#4b5563' : '#e5e7eb' }}>
          <p className={`text-xs text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            Employee? <a href="/login" className="text-blue-600 hover:text-blue-700 font-medium">Login here</a>
          </p>
          <p className={`text-xs text-center mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            Government of India | Ministry of Defence - Sashastra Seema Bal
          </p>
        </div>
      </div>
    </div>
  );
}
