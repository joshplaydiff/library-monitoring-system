import React from 'react';
import { Wifi, WifiOff, Database, Shield, RefreshCw } from 'lucide-react';
import { useIsMobile } from './ui/use-mobile';
import { AnalyticsTooltip, ANALYTICS_DESCRIPTIONS } from './AnalyticsTooltip';

interface SystemHealthProps {
  isOnline: boolean;
  queuedCount: number;
  analytics: any;
  syncing: boolean;
  onSync: () => void;
  onClearQueue: () => void;
}

export function SystemHealth({ isOnline, queuedCount, analytics, syncing, onSync, onClearQueue }: SystemHealthProps) {
  const isMobile = useIsMobile();
  const totalLogs = analytics?.totalVisits || 0;
  const incompleteLogs = analytics?.incompleteLogs || 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Sync Status */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
        <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
          {isOnline ? 
            <Wifi className="w-6 h-6 text-green-500" /> : 
            <WifiOff className="w-6 h-6 text-red-500" />
          }
          <span>Sync Status</span>
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.syncStatus.description} />
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-xl">
            <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <p className="text-sm text-gray-500">Connection</p>
            <p className="font-bold text-gray-800">{isOnline ? 'Online' : 'Offline'}</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-xl">
            <Database className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Pending</p>
            <p className="font-bold text-gray-800">{queuedCount} logs</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-xl">
            <Shield className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Total Logs</p>
            <p className="font-bold text-gray-800">{totalLogs}</p>
          </div>
        </div>

        {/* Sync Controls */}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={onSync}
            disabled={syncing || !isOnline}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              syncing || !isOnline
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
          
          {queuedCount > 0 && (
            <button
              onClick={onClearQueue}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
            >
              <Database className="w-4 h-4" />
              <span>Clear Queue ({queuedCount})</span>
            </button>
          )}
        </div>

        {!isOnline && (
          <p className="mt-3 text-sm text-yellow-600 bg-yellow-50 p-2 rounded-lg">
            ⚠️ You are offline. Changes will be queued and synced when connection is restored.
          </p>
        )}
      </div>

      {/* Data Integrity */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
        <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
          <Shield className="w-6 h-6 text-blue-500" />
          <span>Data Integrity Check</span>
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.dataIntegrity.description} />
        </h3>
        <div className="flex items-center justify-center py-4">
          <div className="text-center">
            <div className={`text-5xl font-bold mb-2 ${
              incompleteLogs > 5 ? 'text-red-500' : 'text-green-500'
            }`}>
              {incompleteLogs}
            </div>
            <p className="text-gray-500">Incomplete Logs (Scanned in but not out)</p>
            <p className="text-sm text-gray-400 mt-2">
              Total Logs: {totalLogs}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}