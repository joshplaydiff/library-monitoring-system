import React, { useEffect, useState, useCallback } from 'react';
import { Users, Clock, User, BookOpen, Wifi, GraduationCap, Briefcase, LogOut, RefreshCw } from 'lucide-react';
import { getActiveUsers, manualLogout } from '../utils/api';
import { AnalyticsTooltip, ANALYTICS_DESCRIPTIONS } from './AnalyticsTooltip';
import { useRefresh } from '../context/RefreshContext';
import { useRealTimeData } from '../context/RealTimeContext';

interface ActiveUser {
  user_type: string;
  user_id?: string | number;
  name?: string;
  purpose: string;
  timestamp: string;
  duration_minutes: number;
}

export function ActiveUsersIndicator() {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loggingOut, setLoggingOut] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const { realTimeData, connectionStatus } = useRealTimeData();

  const loadActiveUsers = useCallback(async () => {
    try {
      const result = await getActiveUsers();
      if (result.success && result.data) {
        setActiveUsers(result.data);
        setLastRefresh(new Date());
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useRefresh('activeUsers', loadActiveUsers);

  useEffect(() => {
    loadActiveUsers();
    const interval = setInterval(loadActiveUsers, 5000);
    const timeInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
    };
  }, [loadActiveUsers]);

  useEffect(() => {
    if (realTimeData.lastUpdate) {
      loadActiveUsers();
    }
  }, [realTimeData.lastUpdate, loadActiveUsers]);

  useEffect(() => {
    if (realTimeData.currentlyInside > 0) {
      loadActiveUsers();
    }
  }, [realTimeData.currentlyInside, loadActiveUsers]);

  const handleManualLogout = async (userId: string | number | undefined) => {
    if (!userId && userId !== 0) {
      console.error('Invalid user ID for logout:', userId);
      alert('Cannot logout: Invalid user ID');
      return;
    }

    const userIdString = String(userId).trim();
    if (userIdString === '') {
      console.error('Invalid user ID for logout:', userId);
      alert('Cannot logout: Invalid user ID');
      return;
    }

    if (!confirm('Are you sure you want to log out this user?')) {
      return;
    }

    setLoggingOut(userIdString);
    const result = await manualLogout(userIdString);
    
    if (result.success) {
      await loadActiveUsers();
    } else {
      console.error('Logout failed:', result.error);
      alert(`Failed to logout user: ${result.error}`);
    }
    setLoggingOut(null);
  };

  const getRealTimeDuration = (entryTimestamp: string) => {
    const entryTime = new Date(entryTimestamp);
    const now = currentTime;
    const diffMs = now.getTime() - entryTime.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return formatDuration(diffMinutes);
  };

  const getUserIcon = (userType: string) => {
    switch (userType) {
      case 'student':
        return <GraduationCap className="w-4 h-4" />;
      case 'faculty':
        return <BookOpen className="w-4 h-4" />;
      case 'staff':
        return <Briefcase className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border-4 border-yellow-500">
        <div className="flex items-center space-x-3 mb-4">
          <Users className="w-5 h-5 text-gray-400" />
          <h3 className="font-semibold text-gray-900">Currently Active Users</h3>
        </div>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border-4 border-yellow-500">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Users className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-gray-900 flex items-center">
              Active Users
              <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.activeUsers.description} />
            </h3>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
              {activeUsers.length}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 text-xs">
              {connectionStatus === 'connected' ? (
                <>
                  <Wifi className="w-3 h-3 text-green-500" />
                  <span className="text-green-600">Live</span>
                </>
              ) : connectionStatus === 'connecting' ? (
                <>
                  <RefreshCw className="w-3 h-3 text-yellow-500 animate-spin" />
                  <span className="text-yellow-600">Connecting</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3 h-3 text-red-500" />
                  <span className="text-red-600">Offline</span>
                </>
              )}
            </div>
            <button
              onClick={loadActiveUsers}
              disabled={loading}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              title="Refresh active users"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
        {activeUsers.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No active users currently</p>
            <p className="text-gray-400 text-xs mt-1">All visitors have checked out</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {activeUsers.map((user, index) => (
              <div
                key={index}
                className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      {getUserIcon(user.user_type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50"></div>
                        <span className="font-medium text-gray-900 text-sm truncate">
                          {user.name || `ID: ${user.user_id || 'Unknown'}`}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded flex-shrink-0">
                          {user.user_type}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 space-y-1">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>Entry: {user.entry_time}</span>
                        </div>
                        <div className="truncate">
                          Purpose: {user.purpose}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end ml-2 flex-shrink-0 space-y-2">
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                         {getRealTimeDuration(user.timestamp)}
                      </div>
                      <div className="text-xs text-gray-500">Time Inside</div>
                    </div>
                    <button
                      onClick={() => handleManualLogout(user.user_id)}
                      disabled={loggingOut === String(user.user_id) || !user.user_id}
                      className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 disabled:text-red-400 disabled:cursor-not-allowed rounded-md transition-colors"
                      title={user.user_id ? "Logout user" : "User ID unavailable"}
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeUsers.length > 0 && (
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Total active users</span>
            <span className="font-medium text-gray-900">{activeUsers.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}
