import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LandingScreen } from './components/LandingScreen';
import { QRScanScreen } from './components/QRScanScreen';
import { QRLogs } from './components/QRLogs';
import { ManualLogs } from './components/ManualLogs';
import { VisitorLoggingForm } from './components/VisitorLoggingForm';
import { UserLogin } from './components/UserLogin';
import { UserPortal } from './components/UserPortal';
import { ForgotPassword } from './components/ForgotPassword';
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { RegisteredUsers } from './components/RegisteredUsers';
import { VisitLogsReports } from './components/VisitLogsReports';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SuccessScreen } from './components/SuccessScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CatalogingPage } from './components/CatalogingPage';
import { syncLogs } from './utils/api';
import { TooltipProvider } from './components/ui/tooltip';
import { RefreshProvider } from './context/RefreshContext';
import { RealTimeProvider } from './context/RealTimeContext';

function AppContent() {
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [userToken, setUserToken] = useState(() => localStorage.getItem('userToken') || '');
  const [userRole, setUserRole] = useState(() => localStorage.getItem('userRole') || '');
  const [userData, setUserData] = useState<any>(() => {
    const stored = localStorage.getItem('currentUserData');
    return stored ? JSON.parse(stored) : null;
  });
  const [queuedLogs, setQueuedLogs] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => {
    const stored = localStorage.getItem('lastSyncTime');
    return stored ? new Date(stored) : null;
  });

  // Check if current route is a user-facing route (mobile attendance logging)
  // Admin routes (/admin/*) are desktop-based and don't need offline indicator
  const isUserRoute = !location.pathname.startsWith('/admin') && location.pathname !== '/admin/login';

  const isAuthenticated = !!userToken;
  const isLibrarianOrAdmin = userRole === 'librarian' || userRole === 'administrator';

  // Handle online/offline events - only for user routes (mobile attendance)
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      
      // Auto-sync queued logs when connection is restored (only for mobile attendance users)
      if (isUserRoute) {
        const stored = localStorage.getItem('queuedLogs');
        if (stored) {
          const logs = JSON.parse(stored);
          if (logs.length > 0) {
            console.log(`Auto-syncing ${logs.length} queued logs...`);
            await performSync(logs);
          }
        }
      }
    };
    
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load queued logs from localStorage (only for mobile attendance users)
    if (isUserRoute) {
      const stored = localStorage.getItem('queuedLogs');
      if (stored) {
        setQueuedLogs(JSON.parse(stored));
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isUserRoute]);

  // Perform sync with progress tracking
  const performSync = useCallback(async (logsToSync?: any[]) => {
    const logs = logsToSync || queuedLogs;
    if (logs.length === 0 || isSyncing) return;

    setIsSyncing(true);
    setSyncProgress(0);

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setSyncProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 200);

    try {
      // Process in batches for reliability
      const BATCH_SIZE = 10;
      let syncedCount = 0;
      const totalLogs = logs.length;

      for (let i = 0; i < logs.length; i += BATCH_SIZE) {
        const batch = logs.slice(i, i + BATCH_SIZE);
        const result = await syncLogs(batch);
        
        if (!result.success) {
          console.error(`Failed to sync batch starting at ${i}:`, result.error);
        } else {
          syncedCount += batch.length;
        }
        
        // Update progress based on actual sync
        const progress = Math.round(((i + batch.length) / totalLogs) * 100);
        setSyncProgress(Math.min(progress, 90));
      }

      // Clear queue after successful sync
      clearInterval(progressInterval);
      setSyncProgress(100);
      
      // Small delay to show 100%
      await new Promise(resolve => setTimeout(resolve, 500));
      
      clearQueue();
      setLastSyncTime(new Date());
      localStorage.setItem('lastSyncTime', new Date().toISOString());
      
      console.log(`Successfully synced ${syncedCount} logs!`);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
      setSyncProgress(0);
    }
  }, [queuedLogs, isSyncing]);

  const addToQueue = (log: any) => {
    const updated = [...queuedLogs, log];
    setQueuedLogs(updated);
    localStorage.setItem('queuedLogs', JSON.stringify(updated));
  };

  const clearQueue = () => {
    setQueuedLogs([]);
    localStorage.removeItem('queuedLogs');
  };

  const handleManualSync = () => {
    if (isOnline && !isSyncing && queuedLogs.length > 0) {
      performSync();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('currentUserData');
    localStorage.removeItem('isAuthenticated');
    setUserToken('');
    setUserRole('');
    setUserData(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 
        OfflineIndicator only shows on user-facing routes (mobile attendance logging).
        Admin staff on desktop don't need this - they have stable internet connections.
      */}
      {isUserRoute && (
        <OfflineIndicator 
          isOnline={isOnline} 
          queuedCount={queuedLogs.length}
          isSyncing={isSyncing}
          syncProgress={syncProgress}
          lastSyncTime={lastSyncTime}
          onManualSync={handleManualSync}
        />
      )}
      <Routes>
        <Route path="/" element={<LandingScreen isOnline={isOnline} />} />
        <Route 
          path="/log" 
          element={
            <QRLogs 
              isOnline={isOnline} 
              addToQueue={addToQueue}
            />
          } 
        />
        <Route 
          path="/manual-log" 
          element={
            <ManualLogs 
              isOnline={isOnline} 
              addToQueue={addToQueue}
            />
          } 
        />
        <Route 
          path="/visitor-log" 
          element={
            <VisitorLoggingForm 
              isOnline={isOnline} 
              addToQueue={addToQueue}
            />
          } 
        />
        <Route path="/success" element={<SuccessScreen onLogout={handleLogout} />} />
        <Route path="/user/login" element={<UserLogin />} />
        <Route path="/user/forgot-password" element={<ForgotPassword />} />
        <Route path="/user/portal" element={
          isAuthenticated ? (
            <UserPortal />
          ) : (
            <Navigate to="/user/login" />
          )
        } />
        <Route 
          path="/admin/login" 
          element={<AdminLogin onLogin={(token: string, role: string) => {
            setUserToken(token);
            setUserRole(role);
            localStorage.setItem('userToken', token);
            localStorage.setItem('userRole', role);
          }} />} 
        />
        <Route 
          path="/admin/dashboard" 
          element={
            isLibrarianOrAdmin ? (
              <AdminDashboard 
                isOnline={isOnline}
                queuedCount={queuedLogs.length}
                clearQueue={clearQueue}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to="/admin/login" />
            )
          } 
        />
        <Route 
          path="/admin/users" 
          element={
            isLibrarianOrAdmin ? (
              <RegisteredUsers />
            ) : (
              <Navigate to="/admin/login" />
            )
          } 
        />
        <Route 
          path="/admin/visit-logs" 
          element={
            isLibrarianOrAdmin ? (
              <VisitLogsReports />
            ) : (
              <Navigate to="/admin/login" />
            )
          } 
        />
        <Route 
          path="/admin/cataloging" 
          element={
            isLibrarianOrAdmin ? (
              <CatalogingPage />
            ) : (
              <Navigate to="/admin/login" />
            )
          } 
        />
        <Route 
          path="/admin/scan" 
          element={
            isLibrarianOrAdmin ? (
              <QRScanScreen isOnline={isOnline} />
            ) : (
              <Navigate to="/admin/login" />
            )
          } 
        />
        {/* Catch-all route for 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <Router>
          <RefreshProvider>
            <RealTimeProvider>
              <AppContent />
            </RealTimeProvider>
          </RefreshProvider>
        </Router>
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
