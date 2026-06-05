import { ReactNode, useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const isDark = localStorage.getItem('darkMode') === 'true';
      setIsDarkMode(isDark);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    // Listen for storage changes (dark mode toggle in other components)
    window.addEventListener('storage', handleStorageChange);
    
    // Also set initial dark mode
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    }

    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isDarkMode]);

  return (
    <div className={`min-h-screen transition-all ${isDarkMode ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' : 'bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50'}`}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Topbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <main className="md:ml-64 pt-16 md:pt-20 min-h-screen">
        <div className="p-3 sm:p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
