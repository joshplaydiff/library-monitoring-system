import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ArrowLeft, BookOpen } from 'lucide-react';
import { loginUser } from '../utils/api';
import { AppFooter } from './AppFooter';

export function UserLogin() {
  const navigate = useNavigate();
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    if (!studentId.trim() || !password) {
      setError('Please enter both ID and Password');
      setLoading(false);
      return;
    }

    const result = await loginUser({
      student_id: studentId.trim(),
      password: password
    });

    if (result.success && result.data) {
      const { token, user } = result.data;
      localStorage.setItem('userToken', token);
      localStorage.setItem('userRole', user.role || 'patron');
      localStorage.setItem('currentUserData', JSON.stringify({
        userId: user.id,
        studentId: user.student_id || user.official_id,
        officialId: user.official_id || user.student_id,
        idClassification: user.id_classification || user.user_type,
        name: user.full_name,
        userType: user.user_type,
        role: user.role,
        email: user.email,
        department: user.department,
        program: user.course || user.program_designation,
        yearLevel: user.year_level || user.year_level_status
      }));
      navigate('/user/portal');
    } else {
      setError(result.error || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col">
      <header className="bg-gray-900 border-b-4 border-yellow-500">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-semibold">Library System</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="max-w-md w-full">
          <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-500 rounded-full mb-4">
                <User className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Student Login</h2>
              <p className="text-gray-400">Enter your student ID and password to access your QR code</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Student ID Number
                </label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="Enter your student ID"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-4 rounded-lg shadow-lg transform transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-400 text-sm">
                Forgot your password?{' '}
                <button
                  onClick={() => navigate('/user/forgot-password')}
                  className="text-yellow-400 hover:text-yellow-300 font-medium"
                >
                  Reset using UST Gmail
                </button>
              </p>
            </div>
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
