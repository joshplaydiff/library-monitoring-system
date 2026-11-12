import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { submitLog } from '../utils/api';
import { useGlobalRefresh } from '../context/RefreshContext';

interface SuccessScreenProps {
  onLogout?: () => void;
}

interface FloatingBook {
  id: number;
  x: number;
  y: number;
  duration: number;
  delay: number;
  size: number;
}

const generateFloatingBooks = (count: number): FloatingBook[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: Math.random() * 10 + 15,
    delay: Math.random() * 10,
    size: Math.random() * 16 + 10
  }));
};

export function SuccessScreen({ onLogout }: SuccessScreenProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logType, isOnline, userName, visitorName, visitorPassId, activeSession, shouldLogout } = location.state || { logType: 'entry', isOnline: true };
  const [floatingBooks] = React.useState(() => generateFloatingBooks(50));
  const { triggerRefresh } = useGlobalRefresh();

  const [hasActiveSession, setHasActiveSession] = React.useState(false);

  React.useEffect(() => {
    const userData = localStorage.getItem('currentUserData');
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        if (parsed.userId) {
          setHasActiveSession(true);
        }
      } catch (e) {}
    }
  }, []);

  const handleExitLogout = async () => {
    const userDataStr = localStorage.getItem('currentUserData');
    const visitorId = localStorage.getItem('currentVisitorId');
    const visitorDataStr = localStorage.getItem('currentVisitorData');

    if (userDataStr) {
      try {
        const userData = JSON.parse(userDataStr);
        await submitLog({
          user_id: userData.userId,
          name: userData.name || '',
          user_type: userData.userType || 'visitor',
          purpose: 'N/A - Exit',
          log_type: 'exit'
        });
      } catch (e) {}
    }

    if (visitorId && visitorDataStr) {
      try {
        const visitorData = JSON.parse(visitorDataStr);
        await submitLog({
          user_id: visitorId,
          name: visitorData.name || 'Visitor',
          user_type: 'visitor',
          purpose: 'N/A - Exit',
          log_type: 'exit'
        });
      } catch (e) {}
    }

    await Promise.all([
      triggerRefresh('activeUsers'),
      triggerRefresh('visitLogs')
    ]);

    localStorage.removeItem('currentUserData');
    localStorage.removeItem('currentVisitorId');
    localStorage.removeItem('currentVisitorData');
    localStorage.removeItem('currentUserId');
    onLogout?.();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {floatingBooks.map((book) => (
          <div
            key={book.id}
            className="absolute text-yellow-400"
            style={{
              width: `${book.size}px`,
              height: `${book.size}px`,
              left: `${book.x}%`,
              top: `${book.y}%`,
              animation: `float-random-${book.id % 5} ${book.duration}s ease-in-out infinite`,
              animationDelay: `${book.delay}s`,
              opacity: Math.random() * 0.25 + 0.1,
              filter: 'drop-shadow(0 0 3px rgba(234, 179, 8, 0.6))'
            }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
              <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 2v12h16V6H4zm2 2h4v2H6V8zm6 0h6v2h-6V8z"/>
            </svg>
          </div>
        ))}
      </div>

      <div className="max-w-md w-full text-center relative z-10">
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 border-4 border-yellow-500">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-yellow-100 rounded-full mb-3">
            <CheckCircle className="w-8 h-8 sm:w-9 sm:h-9 text-yellow-600" />
          </div>

          <div className="mb-3">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
              {activeSession ? 'You Still Have an Active Session' : logType === 'entry' ? 'Entry' : 'Exit'} Logged Successfully!
            </h2>
            <p className="text-sm text-gray-600">
              {activeSession 
                ? `Welcome back, ${visitorName || userName || 'Visitor'}! Your session is still active.`
                : logType === 'entry' 
                  ? 'Welcome to the Library. Enjoy your visit!'
                  : 'Thank you for visiting. See you again soon!'
              }
            </p>
          </div>

          {(logType === 'entry' || activeSession) && visitorPassId && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
              <p className="text-xs text-gray-600 mb-1">
                Your Visitor Pass ID:
              </p>
              <p className="text-base sm:text-lg font-bold text-yellow-800 font-mono">
                {visitorPassId}
              </p>
              {activeSession && (
                <p className="text-xs text-red-600 mt-1">
                  Please log out before leaving
                </p>
              )}
            </div>
          )}

          <div className="inline-block mb-3">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              activeSession 
                ? 'bg-yellow-100 text-yellow-800'
                : isOnline 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
            }`}>
              {activeSession ? 'Session Active - Please Log Out' : isOnline ? 'Synced to server' : 'Saved locally - will sync when online'}
            </span>
          </div>

          <div className="text-xs text-gray-500 mb-4">
            {new Date().toLocaleString('en-US', { 
              dateStyle: 'full', 
              timeStyle: 'short' 
            })}
          </div>

          {activeSession || hasActiveSession ? (
            <button
              onClick={handleExitLogout}
              type="button"
              style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
              className="w-full font-semibold py-3 sm:py-4 px-6 rounded-lg shadow-md transform transition-all duration-200 hover:scale-105 text-base sm:text-base hover:bg-red-700"
            >
              Log Out (Exit)
            </button>
          ) : (
            <button
              onClick={handleExitLogout}
              type="button"
              style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
              className="w-full font-semibold py-3 sm:py-4 px-6 rounded-lg shadow-md transform transition-all duration-200 hover:scale-105 text-base sm:text-base hover:bg-red-700"
            >
              Return to Home
            </button>
          )}
        </div>
      </div>
    </div>
  );
}