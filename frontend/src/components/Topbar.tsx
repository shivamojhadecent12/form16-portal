import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { logout } from '@/lib/auth';
import { useNavigate } from '@tanstack/react-router';

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { user, logout: logoutStore } = useAuthStore();
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    localStorage.setItem('darkMode', isDarkMode.toString());
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleLogout = async () => {
    await logout();
    logoutStore();
    navigate({ to: '/login' });
  };

  return (
    <div className={`h-16 md:h-20 ${isDarkMode ? 'bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-gray-700' : 'bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 border-blue-400'} border-b fixed top-0 right-0 left-0 md:left-64 z-20 transition-all shadow-lg`}>
      <div className="h-full px-3 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <button
            onClick={onMenuClick}
            className={`md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg transition-all ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-blue-700'}`}
            aria-label="Toggle menu"
          >
            <svg
              className={`w-6 h-6 ${isDarkMode ? 'text-gray-300' : 'text-white'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <div className="hidden sm:block">
            <h2 className={`text-base md:text-lg font-bold ${isDarkMode ? 'text-gray-100' : 'text-white'} truncate`}>
              🏛️ SSB Form 16 Portal
            </h2>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-blue-100'}`}>
              Secure Document Management
            </p>
          </div>
          <div className="sm:hidden">
            <p className={`text-base font-bold ${isDarkMode ? 'text-gray-100' : 'text-white'}`}>SSB</p>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-3">
          <div className="hidden sm:flex items-center gap-3">
            <div className="h-10 w-px bg-gradient-to-b from-transparent via-white/30 to-transparent"></div>
            <div className="text-right">
              <p className={`text-sm font-semibold ${isDarkMode ? 'text-gray-100' : 'text-white'} truncate max-w-[120px] md:max-w-none`}>{user?.name}</p>
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-blue-100'}`}>
                {user?.pan}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 rounded-lg transition-all transform hover:scale-110 ${isDarkMode ? 'hover:bg-gray-700 text-yellow-300' : 'hover:bg-blue-700 text-white'}`}
            title="Toggle dark mode"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={`p-2 rounded-lg transition-all transform hover:scale-105 ${isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-blue-700 text-white'}`}
              title="User menu"
            >
              👤
            </button>
            {showUserMenu && (
              <div className={`absolute right-0 mt-2 w-48 rounded-lg shadow-xl ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-blue-200'} z-50`}>
                <button
                  onClick={handleLogout}
                  className={`w-full text-left px-4 py-3 font-medium transition-colors rounded-lg ${isDarkMode ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-red-50 text-red-600'}`}
                >
                  🚪 Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
