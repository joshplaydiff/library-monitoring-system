import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, AlertCircle, X, RefreshCw, CheckCircle, Loader } from 'lucide-react';
import { getOfflineScanStats, syncOfflineScans, checkHealth } from '../utils/api';

interface OfflineIndicatorProps {
  isOnline: boolean;
  queuedCount?: number;
  isSyncing?: boolean;
  syncProgress?: number;
  lastSyncTime?: Date | null;
  onManualSync?: () => void;
}

export function OfflineIndicator({ 
  isOnline, 
  queuedCount: propQueuedCount, 
  isSyncing = false, 
  syncProgress = 0,
  lastSyncTime,
  onManualSync
}: OfflineIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSyncComplete, setShowSyncComplete] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Load stats when component mounts or when online status changes
  useEffect(() => {
    loadStats();
  }, [isOnline]);

  async function loadStats() {
    if (!isIndexedDBAvailable()) return;
    setStatsLoading(true);
    try {
      const result = await getOfflineScanStats();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Failed to load offline stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }

  // Auto-expand when syncing
  useEffect(() => {
    if (isSyncing) {
      setIsExpanded(true);
    }
  }, [isSyncing]);

  // Show sync complete animation
  useEffect(() => {
    if (!isSyncing && !propQueuedCount && lastSyncTime) {
      setShowSyncComplete(true);
      const timer = setTimeout(() => setShowSyncComplete(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isSyncing, propQueuedCount, lastSyncTime]);

  // Don't show anything if online and no queued items (unless recently synced)
  if (isOnline && !propQueuedCount && !showSyncComplete && !statsLoading) return null;

  // Determine status for styling
  const getStatusConfig = () => {
    if (isSyncing) {
      return {
        bgColor: 'bg-blue-500',
        textColor: 'text-white',
        icon: <Loader className="w-4 h-4 animate-spin" />,
        status: 'Syncing...',
        statusText: 'Synchronizing your data'
      };
    }
    if (showSyncComplete) {
      return {
        bgColor: 'bg-green-500',
        textColor: 'text-white',
        icon: <CheckCircle className="w-4 h-4" />,
        status: 'Synced',
        statusText: 'All data synchronized'
      };
    }
    if (!isOnline) {
      return {
        bgColor: 'bg-yellow-500',
        textColor: 'text-gray-900',
        icon: <WifiOff className="w-4 h-4" />,
        status: 'Offline',
        statusText: 'Data will sync when online'
      };
    }
    if (propQueuedCount > 0 || stats?.pending > 0) {
      return {
        bgColor: 'bg-orange-500',
        textColor: 'text-white',
        icon: <RefreshCw className="w-4 h-4" />,
        status: 'Pending',
        statusText: `${propQueuedCount || stats?.pending || 0} item${propQueuedCount || stats?.pending > 1 ? 's' : ''} waiting to sync`
      };
    }
    if (stats?.failed > 0 || stats?.needs_review > 0) {
      return {
        bgColor: 'bg-red-500',
        textColor: 'text-white',
        icon: <AlertCircle className="w-4 h-4" />,
        status: 'Attention Needed',
        statusText: `${stats.failed || 0} failed, ${stats.needs_review || 0} need review`
      };
    }
    return {
      bgColor: 'bg-green-500',
      textColor: 'text-white',
      icon: <Wifi className="w-4 h-4" />,
      status: 'Online',
      statusText: 'All data synced'
    };
  };

  const config = getStatusConfig();

  const handleSync = async () => {
    if (!onManualSync) return;
    setStatsLoading(true);
    try {
      const result = await syncOfflineScans();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  return (
    <>
      {/* Compact Indicator - More prominent for mobile */}
      <div
        className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
          isExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <button
          onClick={() => setIsExpanded(true)}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-full shadow-lg ${config.bgColor} ${config.textColor} ${
            isSyncing ? 'animate-pulse' : ''
          }`}
        >
          {config.icon}
          <span className="text-sm font-medium">
            {config.status}
          </span>
          {(propQueuedCount || stats?.pending || stats?.failed || stats?.needs_review || isSyncing) && (
            <span className="bg-white bg-opacity-30 px-2 py-0.5 rounded-full text-xs font-bold">
              {isSyncing ? `${syncProgress}%` : propQueuedCount || stats?.pending || stats?.failed || stats?.needs_review || 0}
            </span>
          )}
        </button>
      </div>

      {/* Expanded View - Better mobile friendly */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 sm:absolute sm:top-4 sm:right-4 sm:inset-auto sm:pt-0 sm:w-80">
          {/* Backdrop for mobile */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-50 sm:hidden"
            onClick={() => !isSyncing && setIsExpanded(false)}
          />
          
          <div className={`relative bg-white rounded-xl shadow-2xl border border-gray-200 w-full sm:max-w-sm p-4 ${isSyncing ? 'ring-2 ring-blue-500' : ''}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full ${config.bgColor} ${config.textColor} flex items-center justify-center`}>
                  {config.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {config.status}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {config.statusText}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                disabled={isSyncing || statsLoading}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sync Progress Bar */}
            {isSyncing && (
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Synchronizing...</span>
                  <span>{syncProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${syncProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Stats Summary */}
            {(propQueuedCount || stats?.pending || stats?.failed || stats?.needs_review || stats?.synced) && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-900 font-semibold">Synced</p>
                  <p className="text-lg font-bold text-blue-700">{stats?.synced || propQueuedCount}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-green-900 font-semibold">Pending</p>
                  <p className="text-lg font-bold text-green-700">{propQueuedCount || stats?.pending || 0}</p>
                </div>
                {stats?.failed > 0 && (
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-xs text-red-900 font-semibold">Failed</p>
                    <p className="text-lg font-bold text-red-700">{stats.failed}</p>
                  </div>
                )}
                {stats?.needs_review > 0 && (
                  <div className="bg-orange-50 rounded-lg p-3">
                    <p className="text-xs text-orange-900 font-semibold">Review</p>
                    <p className="text-lg font-bold text-orange-700">{stats.needs_review}</p>
                  </div>
                )}
              </div>
            )}

            {/* Status Messages */}
            <div className="space-y-3">
              {/* Offline Notice */}
              {!isOnline && !isSyncing && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-900">
                        You're currently offline
                      </p>
                      <p className="text-xs text-yellow-700 mt-1">
                        Don't worry! Your {propQueuedCount || stats?.pending || 0} log{propQueuedCount || stats?.pending > 1 ? 's' : ''} {propQueuedCount || stats?.pending > 1 ? 'are' : 'is'} saved locally and will sync automatically when your connection returns.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Queued Items */}
              {(propQueuedCount > 0 || stats?.pending > 0) && !isSyncing && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-orange-900">
                      Pending Sync
                    </p>
                    <span className="bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full text-xs font-bold">
                      {propQueuedCount || stats?.pending}
                    </span>
                  </div>
                  <p className="text-xs text-orange-700">
                    {isOnline 
                      ? 'Tap sync now to upload your data' 
                      : 'Waiting for internet connection...'
                    }
                  </p>
                  {isOnline && onManualSync && (
                    <button
                      onClick={handleSync}
                      className="mt-2 w-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Sync Now</span>
                    </button>
                  )}
                </div>
              )}

              {/* Syncing Status */}
              {isSyncing && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <Loader className="w-5 h-5 text-blue-600 animate-spin" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        Syncing your data
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Please keep this page open while we synchronize your {propQueuedCount || stats?.pending || 0} log{propQueuedCount || stats?.pending > 1 ? 's' : ''}.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Success Status */}
              {showSyncComplete && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-900">
                        Sync Complete!
                      </p>
                      <p className="text-xs text-green-700 mt-1">
                        All your data has been successfully synchronized.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Last Sync Time */}
              {lastSyncTime && (
                <div className="text-xs text-gray-400 text-center pt-2">
                  Last synced: {lastSyncTime.toLocaleTimeString()}
                </div>
              )}
            </div>

            {/* Close Button for Mobile */}
            <div className="mt-4 sm:hidden">
              <button
                onClick={() => setIsExpanded(false)}
                disabled={isSyncing || statsLoading}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                {isSyncing ? 'Syncing...' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default OfflineIndicator;
