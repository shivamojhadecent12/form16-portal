import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { login } from '@/lib/auth';
import { useAuthStore } from '@/store/authStore';

export function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  // Employee form only
  const [pan, setPan] = useState('');
  const [name, setName] = useState('');

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
      const user = await login({ pan, name });
      setUser(user);

      // Navigate based on role
      if (user.role === 'admin') {
        navigate({ to: '/admin' });
      } else {
        navigate({ to: '/employee' });
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen transition-all duration-500 ${isDarkMode ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' : 'bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600'} flex items-center justify-center p-4`}>
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
      </div>

      <div className="absolute top-6 right-6 flex gap-3 z-50">
        {/* Admin Link Button */}
        <a
          href="/admin/login"
          className={`p-3 rounded-xl transition-all transform hover:scale-110 backdrop-blur-md ${isDarkMode ? 'bg-gray-800/60 text-gray-400 hover:text-blue-300 hover:bg-gray-700/60' : 'bg-white/20 text-white hover:bg-white/30'}`}
          title="Admin login"
        >
          <span className="text-xl">🔐</span>
        </a>
        
        {/* Dark Mode Toggle */}
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={`p-3 rounded-xl transition-all transform hover:scale-110 backdrop-blur-md ${isDarkMode ? 'bg-gray-800/60 text-yellow-300 hover:bg-gray-700/60' : 'bg-white/20 text-white hover:bg-white/30'}`}
          title="Toggle dark mode"
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Left side - Branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:flex-1 flex-col justify-center items-center text-white z-10 px-8">
        <div className="text-8xl mb-6 animate-bounce">🏛️</div>
        <h1 className="text-5xl font-black mb-4">SSB Form 16</h1>
        <p className="text-2xl font-bold text-blue-100 mb-8">Portal</p>
        <p className="text-lg text-blue-100 max-w-md text-center leading-relaxed">
          Secure Form 16 Document Management System for Sashastra Seema Bal Personnel
        </p>
        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-3 text-blue-100">
            <span className="text-2xl">✅</span>
            <span>Secure & Encrypted</span>
          </div>
          <div className="flex items-center gap-3 text-blue-100">
            <span className="text-2xl">📱</span>
            <span>Mobile Friendly</span>
          </div>
          <div className="flex items-center gap-3 text-blue-100">
            <span className="text-2xl">⚡</span>
            <span>Fast & Reliable</span>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="relative z-10 w-full max-w-md">
        <div className={`backdrop-blur-xl rounded-3xl shadow-2xl p-8 md:p-10 border ${isDarkMode ? 'bg-gray-800/60 border-gray-700/60' : 'bg-white/95 border-white/30'}`}>
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-4 inline-block animate-bounce">🏛️</div>
            <h1 className={`text-3xl md:text-4xl font-black mb-2 ${isDarkMode ? 'text-blue-300' : 'text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600'}`}>
              SSB Portal
            </h1>
            <p className={`text-sm font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Form 16 Management
            </p>
            <div className={`mt-4 h-1 w-12 mx-auto rounded-full ${isDarkMode ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gradient-to-r from-blue-600 to-indigo-600'}`}></div>
          </div>

          {/* Error Message */}
          {error && (
            <div className={`mb-6 p-4 rounded-xl border ${isDarkMode ? 'bg-red-900/30 border-red-700/50 text-red-300' : 'bg-red-50 border-red-200 text-red-700'} animate-pulse`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <p className="text-sm font-semibold">{error}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* PAN Input */}
            <div>
              <label className={`block text-sm font-bold uppercase tracking-wider mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                📋 PAN Number
              </label>
              <input
                type="text"
                value={pan}
                onChange={(e) => setPan(e.target.value.toUpperCase())}
                className={`w-full px-4 py-3 rounded-xl border-2 transition-all focus:outline-none font-mono text-lg font-bold ${
                  isDarkMode 
                    ? 'bg-gray-700/50 border-gray-600 focus:border-blue-500 text-white placeholder-gray-500' 
                    : 'bg-white/50 border-gray-200 focus:border-blue-500 text-gray-900 placeholder-gray-400'
                }`}
                placeholder="ABCDE1234F"
                maxLength={10}
                required
              />
              <p className={`text-xs mt-2 font-semibold leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Enter your 10-digit PAN exactly as it appears on your documents
              </p>
            </div>

            {/* Name Input */}
            <div>
              <label className={`block text-sm font-bold uppercase tracking-wider mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                👤 Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border-2 transition-all focus:outline-none text-lg font-semibold ${
                  isDarkMode 
                    ? 'bg-gray-700/50 border-gray-600 focus:border-blue-500 text-white placeholder-gray-500' 
                    : 'bg-white/50 border-gray-200 focus:border-blue-500 text-gray-900 placeholder-gray-400'
                }`}
                placeholder="Your Full Name"
                required
              />
              <p className={`text-xs mt-2 font-semibold leading-relaxed ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                As it appears in your Form-16 document
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-6 rounded-xl font-black uppercase tracking-wider text-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${
                isDarkMode
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg'
              }`}
            >
              {loading ? '🔄 Logging In...' : '🚀 Enter Portal'}
            </button>
          </form>

          {/* Footer */}
          <div className={`mt-8 pt-6 border-t ${isDarkMode ? 'border-gray-700/50' : 'border-gray-200'}`}>
            <p className={`text-xs text-center font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
              🇮🇳 Government of India | Sashastra Seema Bal
            </p>
            <p className={`text-xs text-center mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              SSB Form 16 Portal v2.0 • Secure & Confidential
            </p>
          </div>
        </div>

        {/* Mobile only - Features */}
        <div className="lg:hidden mt-8 space-y-3 text-white">
          <div className="flex items-center gap-3 text-sm font-semibold">
            <span className="text-2xl">✅</span>
            <span>Secure & Encrypted</span>
          </div>
          <div className="flex items-center gap-3 text-sm font-semibold">
            <span className="text-2xl">📱</span>
            <span>Mobile Optimized</span>
          </div>
          <div className="flex items-center gap-3 text-sm font-semibold">
            <span className="text-2xl">⚡</span>
            <span>Lightning Fast</span>
          </div>
        </div>
      </div>
    </div>
  );
}
