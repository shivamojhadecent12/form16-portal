import { Link, useLocation } from '@tanstack/react-router';
import { useAuthStore } from '@/store/authStore';
import { useState, useEffect } from 'react';

interface NavItem {
  name: string;
  path: string;
  icon: string;
  roles: ('admin' | 'employee')[];
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const adminNavItems: NavItem[] = [
  { name: 'Dashboard', path: '/admin', icon: '📊', roles: ['admin'] },
  { name: 'Employees', path: '/admin/employees', icon: '👥', roles: ['admin'] },
  { name: 'Documents', path: '/admin/documents', icon: '📄', roles: ['admin'] },
  { name: 'Manage Files', path: '/admin/manage-files', icon: '🗂️', roles: ['admin'] },
  { name: 'Import Center', path: '/admin/import', icon: '📥', roles: ['admin'] },
  { name: 'Review Queue', path: '/admin/review', icon: '✅', roles: ['admin'] },
  { name: 'Audit Logs', path: '/admin/audit', icon: '📋', roles: ['admin'] },
  { name: 'Settings', path: '/admin/settings', icon: '⚙️', roles: ['admin'] },
];

const employeeNavItems: NavItem[] = [
  { name: 'Dashboard', path: '/employee', icon: '🏠', roles: ['employee'] },
  { name: 'My Documents', path: '/employee/documents', icon: '📄', roles: ['employee'] },
  { name: 'Year Comparison', path: '/employee/comparison', icon: '📈', roles: ['employee'] },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuthStore();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  useEffect(() => {
    const handleStorageChange = () => {
      setIsDarkMode(localStorage.getItem('darkMode') === 'true');
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const navItems = user?.role === 'admin' ? adminNavItems : employeeNavItems;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`w-64 h-screen fixed left-0 top-0 overflow-y-auto z-40 transition-all duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${isDarkMode ? 'bg-gradient-to-b from-gray-900 to-gray-800 border-gray-700' : 'bg-gradient-to-b from-white via-blue-50 to-indigo-50 border-gray-200'} border-r`}
      >
        {/* Header */}
        <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-3xl">🏛️</span>
            <h1 className={`text-2xl font-black ${isDarkMode ? 'text-blue-300' : 'text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600'}`}>
              SSB
            </h1>
          </div>
          <p className={`text-xs font-semibold tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-blue-700'} uppercase`}>
            Form 16 Portal
          </p>
          <div className={`mt-3 h-1 w-full rounded-full ${isDarkMode ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gradient-to-r from-blue-400 to-indigo-500'}`}></div>
        </div>

        {/* User Info */}
        <div className={`mx-4 mt-6 p-4 rounded-xl ${isDarkMode ? 'bg-gray-700' : 'bg-white'} border ${isDarkMode ? 'border-gray-600' : 'border-blue-200'}`}>
          <p className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-blue-600'}`}>
            {user?.role === 'admin' ? '🔐 Administrator' : '👤 Employee'}
          </p>
          <p className={`font-bold mt-2 truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            {user?.name}
          </p>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {user?.pan}
          </p>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2 mt-6">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 transform hover:scale-105 group ${
                  isActive
                    ? isDarkMode
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-lg'
                      : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold shadow-lg'
                    : isDarkMode
                    ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    : 'text-gray-700 hover:bg-blue-100 hover:text-blue-900'
                }`}
              >
                <span className={`text-xl transition-transform ${isActive ? 'scale-125' : 'group-hover:scale-110'}`}>
                  {item.icon}
                </span>
                <span className="font-medium">{item.name}</span>
                {isActive && (
                  <span className="ml-auto">
                    <span className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-blue-200' : 'bg-white'}`}></span>
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={`absolute bottom-0 left-0 right-0 p-4 border-t ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-blue-200 bg-blue-50'}`}>
          <p className={`text-xs text-center font-semibold ${isDarkMode ? 'text-gray-500' : 'text-blue-600'}`}>
            ✨ SSB Form 16 Portal v2.0
          </p>
        </div>
      </div>
    </>
  );
}
