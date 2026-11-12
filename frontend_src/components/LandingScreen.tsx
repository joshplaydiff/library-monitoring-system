import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, UserPlus, BookOpen, LogOut, AlertTriangle, User } from 'lucide-react';
import { AppFooter } from './AppFooter';
import { checkVisitorActiveSession, checkUserActive, submitLog } from '../utils/api';
import { useGlobalRefresh } from '../context/RefreshContext';

interface LandingScreenProps {
  isOnline: boolean;
}

export function LandingScreen({ isOnline }: LandingScreenProps) {
  const navigate = useNavigate();
  const { triggerRefresh } = useGlobalRefresh();
  const [hasActiveVisitorSession, setHasActiveVisitorSession] = useState(false);
  const [hasActiveUserSession, setHasActiveUserSession] = useState(false);
  const [activeUserData, setActiveUserData] = useState<{name?: string; userId?: string; userType?: string} | null>(null);
  const [activeVisitorData, setActiveVisitorData] = useState<{name?: string; visitorPassId?: string} | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const checkActiveSession = async () => {
      const visitorId = localStorage.getItem('currentVisitorId');
      const userDataStr = localStorage.getItem('currentUserData');
      
      // Check for visitor session first
      if (visitorId) {
        // Verify with backend database
        if (isOnline) {
          const result = await checkVisitorActiveSession(visitorId);
          if (result.success && result.active) {
            // Session verified in database
            const visitorData = localStorage.getItem('currentVisitorData');
            let visitorName = 'Visitor';
            try {
              if (visitorData) {
                const data = JSON.parse(visitorData);
                visitorName = data.name || 'Visitor';
              }
            } catch (e) {}
            
            setHasActiveVisitorSession(true);
            setActiveVisitorData({ name: visitorName, visitorPassId: visitorId });
          } else {
            // No active session in database, clear localStorage
            localStorage.removeItem('currentVisitorId');
            localStorage.removeItem('currentVisitorData');
          }
        } else {
          // Offline - rely on localStorage
          const visitorData = localStorage.getItem('currentVisitorData');
          let visitorName = 'Visitor';
          try {
            if (visitorData) {
              const data = JSON.parse(visitorData);
              visitorName = data.name || 'Visitor';
            }
          } catch (e) {}
          
          setHasActiveVisitorSession(true);
          setActiveVisitorData({ name: visitorName, visitorPassId: visitorId });
        }
      } else if (userDataStr) {
        // Check for student/employee session
        if (isOnline) {
          try {
            const userData = JSON.parse(userDataStr);
            const result = await checkUserActive(userData.userId);
            if (result.success && result.data) {
              // Session verified in database
              setHasActiveUserSession(true);
              setActiveUserData(userData);
            } else {
              // No active session in database, clear localStorage
              localStorage.removeItem('currentUserData');
            }
          } catch (e) {
            localStorage.removeItem('currentUserData');
          }
        } else {
          // Offline - rely on localStorage
          try {
            const userData = JSON.parse(userDataStr);
            setHasActiveUserSession(true);
            setActiveUserData(userData);
          } catch (e) {
            localStorage.removeItem('currentUserData');
          }
        }
      }
      setCheckingSession(false);
    };

    checkActiveSession();
  }, [isOnline]);

  const handleLogout = async (type: 'visitor' | 'user') => {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      if (type === 'visitor') {
        const visitorId = localStorage.getItem('currentVisitorId');
        const visitorDataStr = localStorage.getItem('currentVisitorData');
        let visitorName = 'Visitor';
        try {
          if (visitorDataStr) {
            const data = JSON.parse(visitorDataStr);
            visitorName = data.name || 'Visitor';
          }
        } catch (e) {}

        await submitLog({
          user_id: visitorId || 'visitor',
          name: visitorName,
          user_type: 'visitor',
          purpose: 'N/A - Exit',
          log_type: 'exit'
        });

        localStorage.removeItem('currentVisitorId');
        localStorage.removeItem('currentVisitorData');
        setHasActiveVisitorSession(false);
        setActiveVisitorData(null);
      } else {
        const userDataStr = localStorage.getItem('currentUserData');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          await submitLog({
            user_id: userData.userId,
            name: userData.name || '',
            user_type: userData.userType || 'student',
            purpose: 'N/A - Exit',
            log_type: 'exit'
          });
        }

        localStorage.removeItem('currentUserData');
        setHasActiveUserSession(false);
        setActiveUserData(null);
      }

      await Promise.all([
        triggerRefresh('activeUsers'),
        triggerRefresh('visitLogs')
      ]);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoggingOut(false);
    }
  };

  const handleVisitorClick = () => {
    if (hasActiveVisitorSession || hasActiveUserSession) {
      return;
    }
    navigate('/visitor-log');
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <header className="bg-gray-900 border-b-4 border-yellow-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-500 rounded-lg flex items-center justify-center shadow-lg">
                  <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-white">University Library and Information Services</h1>
                  <p className="text-xs sm:text-sm text-gray-400">University of Santo Tomas - Lagazpi</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Checking active sessions...</p>
          </div>
        </main>
      </div>
    );
  }

  const hasActiveSession = hasActiveVisitorSession || hasActiveUserSession;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="bg-gray-900 border-b-4 border-yellow-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-500 rounded-lg flex items-center justify-center shadow-lg">
                <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white">University Library and Information Services</h1>
                <p className="text-xs sm:text-sm text-gray-400">University of Santo Tomas - Lagazpi</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Active Session Alert */}
      {hasActiveSession && (
        <div className="bg-yellow-500/20 border-b border-yellow-500/50 px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-yellow-400">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-sm font-medium">
                You have an active session: {activeUserData?.name || activeVisitorData?.name || 'User'}
              </span>
            </div>
            <button
              onClick={() => handleLogout(activeVisitorData ? 'visitor' : 'user')}
              disabled={loggingOut}
              className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {loggingOut ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              Log Out Now
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-md w-full space-y-6 sm:space-y-8">
          {/* Hero Section */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-32 h-32 sm:w-36 sm:h-36 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 rounded-lg mb-4 sm:mb-6 shadow-lg animate-pulse">
              <QrCode className="w-24 h-24 sm:w-28 sm:h-28 text-yellow-500" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 sm:mb-3">
              Library Monitoring System
            </h2>
            <p className="text-sm sm:text-base text-gray-300 px-2">
              Fast and secure entry and exit logging for library users
            </p>
          </div>

          {/* Primary Action */}
          <div className="space-y-3 sm:space-y-4">
            <button
              onClick={() => navigate('/user/login')}
              disabled={hasActiveSession}
              className={`w-full font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-lg shadow-lg transform transition-all duration-200 flex items-center justify-center space-x-2 sm:space-x-3 ${
                hasActiveSession 
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                  : 'bg-yellow-500 hover:bg-yellow-600 text-white hover:scale-105'
              }`}
            >
              <User className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-base sm:text-lg">Student Login | My QR Code</span>
            </button>

            <button
              onClick={handleVisitorClick}
              disabled={hasActiveSession}
              className={`w-full font-medium py-3 sm:py-4 px-4 sm:px-6 rounded-lg shadow-lg transform transition-all duration-200 flex items-center justify-center space-x-2 sm:space-x-3 ${
                hasActiveSession 
                  ? 'bg-yellow-500 text-white cursor-not-allowed' 
                  : hasActiveVisitorSession 
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white hover:scale-105' 
                    : 'bg-white hover:bg-gray-50 text-gray-900 hover:scale-105'
              }`}
            >
              <UserPlus className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-base sm:text-lg">
                {hasActiveSession 
                  ? 'Active Session - Log Out First' 
                  : hasActiveVisitorSession 
                    ? 'Visitor Pass | Check-Out Now' 
                    : 'Visitor Pass | Unregistered'
                }
              </span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <AppFooter />
    </div>
  );
}
