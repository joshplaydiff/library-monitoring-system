import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, ArrowLeft, BookOpen } from 'lucide-react';
import { AppFooter } from './AppFooter';

interface FloatingIcon {
  id: number;
  x: number;
  y: number;
  duration: number;
  delay: number;
  size: number;
}

const generateFloatingIcons = (count: number): FloatingIcon[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: Math.random() * 10 + 15,
    delay: Math.random() * 10,
    size: Math.random() * 30 + 15
  }));
};

interface AdminLoginProps {
  onLogin: (token: string, role: string) => void;
}

export function AdminLogin({ onLogin }: AdminLoginProps) {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [floatingIcons] = useState(() => generateFloatingIcons(50));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const apiUrl = `${import.meta.env.VITE_API_URL}/auth/login`;
    console.log('Attempting login to:', apiUrl);
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          // Store token if needed
          if (data.data?.token) {
            localStorage.setItem('userToken', data.data.token);
            const userRole = data.data.user?.role || 'patron';
            localStorage.setItem('userRole', userRole);
            onLogin(data.data.token, userRole);
            navigate('/admin/dashboard');
          } else {
            setError('Login response missing token');
          }
        } else {
          setError(data.error || 'Invalid username or password');
        }
      } else {
        setError('Invalid username or password');
      }
    } catch (error) {
      setError('Network error. Please try again.');
      console.error('Login error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col relative overflow-hidden">

      {/* Floating Shields Background - Only in main content area, not footer */}
      <div className="absolute pointer-events-none" style={{ top: 0, left: 0, right: 0, bottom: '60px' }}>
        {floatingIcons.map((icon) => (
          <div
            key={icon.id}
            className="absolute"
            style={{
              width: `${icon.size}px`,
              height: `${icon.size}px`,
              left: `${icon.x}%`,
              top: `${icon.y}%`,
              animation: `shield-float-${icon.id % 5} ${icon.duration}s ease-in-out infinite`,
              animationDelay: `${icon.delay}s`,
              opacity: Math.random() * 0.25 + 0.1
            }}
          >
            <svg viewBox="0 0 24 24" className="w-full h-full" fill="#eab308" style={{ filter: 'drop-shadow(0 0 5px rgba(234, 179, 8, 0.7))' }}>
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
            </svg>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="bg-gray-900 border-b-4 border-yellow-500 relative z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-1 sm:space-x-2 text-gray-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-sm sm:text-base">Back to Home</span>
            </button>
            <div className="flex items-center space-x-1 sm:space-x-2">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />
              <span className="text-white font-semibold text-sm sm:text-base">University Library and Information Services</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12 relative z-10">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="text-center">
              <svg viewBox="0 0 24 24" className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-3 sm:mb-4" fill="#eab308" style={{ filter: 'drop-shadow(0 0 5px rgba(234, 179, 8, 0.7))' }}>
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
              </svg>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                Admin Login
              </h2>
              <p className="text-sm sm:text-base text-gray-600">
                Access the administrative dashboard
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="username"
                    value={credentials.username}
                    onChange={(e) => {
                      setCredentials({ ...credentials, username: e.target.value });
                      setError('');
                    }}
                    placeholder="Enter your username"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    id="password"
                    value={credentials.password}
                    onChange={(e) => {
                      setCredentials({ ...credentials, password: e.target.value });
                      setError('');
                    }}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    required
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold py-3 sm:py-3 px-6 rounded-lg shadow-md transform transition-all duration-200 hover:scale-105 text-base sm:text-base"
              >
                Sign In
              </button>
            </form>

            
            {/* Security Note */}
            <div className="text-center">
              <p className="text-xs text-gray-500">
                This is a secure area. All access attempts are logged.
              </p>
            </div>
          </div>
        </div>
      </main>
      {/* Clean Footer */}
      <footer className="bg-gray-900 border-t-4 border-yellow-500 py-4 relative z-30">
        <div className="max-w-7xl mx-auto px-4"></div>
      </footer>
    </div>
  );
}