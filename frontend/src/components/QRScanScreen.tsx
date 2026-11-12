import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, ArrowLeft, CheckCircle, XCircle, Wifi, WifiOff, RefreshCw, User, Clock, MapPin, FileText, Menu, Plus, RefreshCw as RefreshIcon } from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { AppFooter } from './AppFooter';
import { scanAttendance, saveOfflineScan, getOfflineScanStats, syncOfflineScans, checkHealth } from '../utils/api';

interface QRScanScreenProps {
  isOnline: boolean;
}

interface ScanResult {
  id: number;
  user_id: number | null;
  official_id: string | null;
  id_type: string | null;
  name: string;
  user_type: string;
  purpose: string;
  section: string | null;
  room_id: number | null;
  log_type: 'entry' | 'exit';
  timestamp: string;
  client_event_id: string | null;
  idempotent: boolean;
}

// Local roster entry for offline scanning
interface LocalRosterEntry {
  official_id: string;
  id_type: string;
  full_name: string;
  user_type: string;
}

const PURPOSES = [
  { value: 'General', label: 'General Visit' },
  { value: 'Study', label: 'Study / Research' },
  { value: 'Borrowing Books', label: 'Borrowing Books' },
  { value: 'Computer Use', label: 'Computer Use' },
  { value: 'Group Discussion', label: 'Group Discussion' },
  { value: 'Meeting', label: 'Meeting' },
  { value: 'Other', label: 'Other' }
];

const SECTIONS = [
  { value: 'Main Library', label: 'Main Library' },
  { value: 'Learning Commons', label: 'Learning Commons' },
  { value: 'Meeting Room', label: 'Meeting Room' }
];

export function QRScanScreen({ isOnline }: QRScanScreenProps) {
  const navigate = useNavigate();
  const [scanStatus, setScanStatus] = useState<'scanning' | 'success' | 'error' | null>('scanning');
  const [message, setMessage] = useState('');
  const [showScanner, setShowScanner] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedPurpose, setSelectedPurpose] = useState('General');
  const [selectedSection, setSelectedSection] = useState('Main Library');
  const [offlineMode, setOfflineMode] = useState(false);
  const [localRoster, setLocalRoster] = useState<LocalRosterEntry[]>([]);
  const lastScannedValue = useRef<string | null>(null);
  const lastScanTime = useRef<number>(0);
  const pendingScan = useRef<{ rawValue: string; timestamp: number; clientEventId: string } | null>(null);

  // Generate a unique client event id for idempotent scan deduplication
  const generateClientEventId = useCallback(() => {
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
  }, []);

  // Check if we should operate in offline mode
  const isOffline = !isOnline;

  const handleScan = async (detectedCodes: any[]) => {
    // Prevent processing while a scan is already in flight
    if (processing) return;
    if (!detectedCodes || detectedCodes.length === 0) return;

    const { rawValue } = detectedCodes[0];
    const now = Date.now();

    // Single debounce check: ignore re-scans of the same code within 3 seconds
    if (lastScannedValue.current === rawValue && now - lastScanTime.current < 3000) {
      return;
    }

    // Record this scan attempt immediately to prevent duplicate processing
    lastScannedValue.current = rawValue;
    lastScanTime.current = now;

    setProcessing(true);
    setShowScanner(false);
    pendingScan.current = { rawValue, timestamp: now, clientEventId: generateClientEventId() };

    try {
      let idType = 'student';
      let officialId = rawValue;

      // Parse the QR payload
      try {
        const qrData = JSON.parse(rawValue);
        // Static QR payload: { id_type, official_id }
        if (qrData.id_type && qrData.official_id) {
          idType = String(qrData.id_type);
          officialId = String(qrData.official_id).trim(); // preserve leading zeros as string
        } else {
          // Malformed QR — missing required fields
          setScanStatus('error');
          setMessage('Invalid QR code. Please use a valid patron QR code.');
          setProcessing(false);
          setShowScanner(true);
          lastScannedValue.current = null;
          lastScanTime.current = 0;
          pendingScan.current = null;
          return;
        }
      } catch {
        // Not JSON — reject as we need structured data
        setScanStatus('error');
        setMessage('Invalid QR code format. Please use a valid patron QR code.');
        setProcessing(false);
        setShowScanner(true);
        lastScannedValue.current = null;
        lastScanTime.current = 0;
        pendingScan.current = null;
        return;
      }

      // Verify this is still the pending scan (prevent race conditions)
      if (
        !pendingScan.current ||
        pendingScan.current.rawValue !== rawValue ||
        pendingScan.current.timestamp !== now
      ) {
        return;
      }

      // Check local roster for offline verification
      const localPatron = localRoster.find(
        (p: LocalRosterEntry) => p.official_id === officialId && p.id_type === idType
      );

      if (isOffline) {
        // Offline mode: save to IndexedDB, mark as provisional
        if (!localPatron) {
          setScanStatus('error');
          setMessage(`Patron ${officialId} (${idType}) not found in local roster. Cannot verify offline.`);
          setProcessing(false);
          setShowScanner(true);
          lastScannedValue.current = null;
          lastScanTime.current = 0;
          pendingScan.current = null;
          return;
        }

        // Save offline event
        const offlineResult = await saveOfflineScan({
          client_event_id: pendingScan.current.clientEventId,
          official_id: officialId,
          id_type: idType,
          purpose: selectedPurpose,
          section: selectedSection,
          room_id: null,
          log_type: 'entry' // Default to entry for offline; will be reconciled on sync
        });

        pendingScan.current = null;

        if (offlineResult.success) {
          setScanResult({
            id: -1, // Temporary ID, will be replaced on sync
            user_id: null,
            official_id: officialId,
            id_type: idType,
            name: localPatron.full_name,
            user_type: localPatron.user_type,
            purpose: selectedPurpose,
            section: selectedSection,
            room_id: null,
            log_type: 'entry',
            timestamp: new Date().toISOString(),
            client_event_id: pendingScan.current!.clientEventId,
            idempotent: false
          });
          setScanStatus('success');
          setMessage(`OFFLINE: ${localPatron.full_name} (${officialId}) - ${selectedPurpose} at ${selectedSection}. Will sync when online.`);
        } else {
          setScanStatus('error');
          setMessage(offlineResult.error || 'Failed to save offline attendance');
          lastScannedValue.current = null;
          lastScanTime.current = 0;
          setProcessing(false);
          setShowScanner(true);
        }
      } else {
        // Online mode: call server-authoritative scan endpoint
        const scanResult = await scanAttendance({
          client_event_id: pendingScan.current.clientEventId,
          official_id: officialId,
          id_type: idType,
          purpose: selectedPurpose,
          section: selectedSection,
          room_id: null
        });

        // Clear the pending scan marker
        pendingScan.current = null;

        if (scanResult.success && scanResult.data) {
          const data = scanResult.data as ScanResult;
          setScanResult(data);
          setScanStatus('success');

          const action = data.log_type === 'entry' ? 'Time-in' : 'Time-out';
          setMessage(`${action} recorded for ${data.name} (${data.official_id})`);
        } else {
          // Server did not confirm persistence — do not show success
          setScanStatus('error');
          setMessage(scanResult.error || 'Failed to record attendance. Please try again.');
          // Reset debounce on failure so the user can retry
          lastScannedValue.current = null;
          lastScanTime.current = 0;
          setProcessing(false);
          setShowScanner(true);
        }
      }
    } catch (error) {
      pendingScan.current = null;
      setScanStatus('error');
      setMessage('Failed to process QR code');
      // Reset debounce on failure so the user can retry
      lastScannedValue.current = null;
      lastScanTime.current = 0;
      setProcessing(false);
      setShowScanner(true);
    } finally {
      if (!pendingScan.current) {
        setProcessing(false);
      }
    }
  };

  const handleError = (error: any) => {
    console.error('QR Scanner error:', error);
    setScanStatus('error');

    let errorMessage = 'Camera access denied or scanner error';
    if (error?.name === 'NotFoundError' || error?.message?.includes('Requested device not found')) {
      errorMessage = 'No camera detected. Please ensure a camera is connected and try again.';
    } else if (error?.name === 'NotAllowedError' || error?.message?.includes('Permission denied')) {
      errorMessage = 'Camera permission denied. Please allow camera access and reload the page.';
    } else if (error?.name === 'NotReadableError' || error?.message?.includes('Device not readable')) {
      errorMessage = 'Camera is being used by another application. Please close other apps using the camera.';
    }

    setMessage(errorMessage);
    setShowScanner(false);
  };

  const resetScanner = () => {
    setScanStatus('scanning');
    setMessage('');
    setShowScanner(true);
    setProcessing(false);
    setScanResult(null);
    lastScannedValue.current = null;
    lastScanTime.current = 0;
    pendingScan.current = null;
  };

  const handleManualEntry = () => {
    navigate('/admin/visit-logs');
  };

  // Load local roster from localStorage (set by librarian when online)
  useEffect(() => {
    const stored = localStorage.getItem('local_roster');
    if (stored) {
      try {
        setLocalRoster(JSON.parse(stored));
      } catch {
        setLocalRoster([]);
      }
    } else {
      setLocalRoster([]);
    }
  }, []);

  // Handle offline/online changes
  useEffect(() => {
    if (!isOnline) {
      setOfflineMode(true);
    } else {
      setOfflineMode(false);
      // Auto-sync offline events when coming back online
      syncOfflineScans().then(result => {
        if (result.success) {
          setMessage(`Synced ${result.data?.synced_count || 0} offline events`);
        }
      });
    }
  }, [isOnline]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b-4 border-yellow-500 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="flex items-center space-x-1 sm:space-x-2 text-gray-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-sm sm:text-base">Back to Dashboard</span>
            </button>
            <div className="flex items-center space-x-1 sm:space-x-2">
              {isOnline ? (
                <>
                  <Wifi className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                  <span className="text-xs sm:text-sm text-green-400">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                  <span className="text-xs sm:text-sm text-yellow-400">Offline Mode</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-6 sm:py-8">
        <div className="max-w-md w-full space-y-4 sm:space-y-6">
          {/* Instructions */}
          <div className="text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Library Entry / Exit Scanner</h2>
            <p className="text-sm sm:text-base text-gray-400 px-2">
              Scan patron QR code to record entry or exit
            </p>
          </div>

          {/* Visit Configuration */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">
                  Purpose of Visit
                </label>
                <select
                  value={selectedPurpose}
                  onChange={(e) => setSelectedPurpose(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
                >
                  {PURPOSES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">
                  Library Section
                </label>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
                >
                  {SECTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Local Roster (Offline Mode) */}
          {isOffline && localRoster.length > 0 && (
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-blue-900 uppercase">Local Roster</span>
                <span className="text-xs text-blue-600">{localRoster.length} patrons</span>
              </div>
              <div className="overflow-y-auto max-h-32 space-y-1">
                {localRoster.map((p) => (
                  <div key={`${p.official_id}-${p.id_type}`} className="text-sm">
                    <span className="font-medium text-gray-900">{p.full_name}</span>
                    <span className="ml-2 text-xs font-mono text-gray-500">{p.official_id}</span>
                    <span className="ml-2 text-xs text-blue-500 capitalize">{p.id_type}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Scan a patron's QR code to verify against local roster and record attendance offline.
              </p>
            </div>
          )}

          {/* Scanner Frame */}
          <div className="relative bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-2xl">
            <div className="aspect-square bg-gray-900 rounded-xl overflow-hidden relative border-4 border-gray-700">
              {/* Actual QR/Barcode Scanner */}
              {showScanner && (
                <Scanner
                  onScan={handleScan}
                  onError={handleError}
                  constraints={{
                    facingMode: 'user'
                  }}
                  formats={[
                    'qr_code',
                    'code_128',
                    'code_39',
                    'ean_13',
                    'ean_8',
                    'upc_a',
                    'upc_e',
                    'code_93',
                    'itf',
                    'pdf417'
                  ]}
                />
              )}

              {/* Success State — Scan Result Details */}
              {!showScanner && scanStatus === 'success' && scanResult && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-900 bg-opacity-20 p-4">
                  <CheckCircle className="w-16 h-16 sm:w-20 sm:h-20 text-green-400 mb-4" />
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 w-full max-w-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <User className="w-5 h-5 text-green-400" />
                      <span className="text-white font-medium">{scanResult.name}</span>
                    </div>
                    <div className="text-xs text-green-300 mb-1">Official UST ID</div>
                    <div className="text-sm text-white font-mono mb-3">{scanResult.official_id}</div>
                    <div className="flex items-center gap-3 mb-3">
                      <FileText className="w-5 h-5 text-green-400" />
                      <span className="text-sm text-white capitalize">{scanResult.id_type}</span>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <Clock className="w-5 h-5 text-green-400" />
                      <span className="text-sm text-white capitalize">{scanResult.log_type}</span>
                    </div>
                    <div className="text-xs text-green-300 mb-1">Timestamp</div>
                    <div className="text-sm text-white font-mono mb-3">{scanResult.timestamp}</div>
                    <div className="flex items-center gap-3 mb-3">
                      <MapPin className="w-5 h-5 text-green-400" />
                      <span className="text-sm text-white">{scanResult.section || 'Main Library'}</span>
                    </div>
                    <div className="text-xs text-green-300 mb-1">Purpose</div>
                    <div className="text-sm text-white">{scanResult.purpose}</div>
                    {scanResult.idempotent && (
                      <div className="mt-3 text-xs text-yellow-300">Duplicate scan — result from previous record.</div>
                    )}
                  </div>
                  <p className="text-green-400 font-semibold mt-4 text-center px-2">
                    {scanResult.log_type === 'entry' ? 'Time-in recorded' : 'Time-out recorded'}
                  </p>
                </div>
              )}

              {/* Error State */}
              {!showScanner && scanStatus === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900 bg-opacity-20 p-4">
                  <XCircle className="w-16 h-16 sm:w-20 sm:h-20 text-red-400 mb-4" />
                  <p className="text-red-400 font-semibold text-base sm:text-lg text-center px-2 mb-4">{message}</p>
                  <button
                    onClick={resetScanner}
                    className="bg-red-500/20 hover:bg-red-500/30 border border-red-500 text-red-400 px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    Scan Again
                  </button>
                </div>
              )}
            </div>

            {/* Offline Mode Indicator */}
            {!isOnline && (
              <div className="mt-3 sm:mt-4 bg-yellow-500 bg-opacity-20 border border-yellow-500 rounded-lg p-3">
                <p className="text-yellow-400 text-xs sm:text-sm text-center">
                  <WifiOff className="w-3 h-3 sm:w-4 sm:h-4 inline mr-2" />
                  Offline mode: QR scanning saves locally. Events sync when connection returns.
                </p>
              </div>
            )}
          </div>

          {/* Alternative Actions */}
          <div className="text-center space-y-2 sm:space-y-3">
            {!showScanner && (
              <button
                onClick={resetScanner}
                className="inline-flex items-center space-x-2 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-medium py-2 px-6 rounded-lg"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Scan Next Patron</span>
              </button>
            )}
            <p className="text-gray-500 text-xs sm:text-sm">Having trouble scanning?</p>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-4">
              <button
                onClick={resetScanner}
                className="text-yellow-500 hover:text-yellow-400 font-medium transition-colors text-sm sm:text-sm"
              >
                Try scanning again
              </button>
              <span className="text-gray-600 text-xs sm:text-sm">or</span>
              <button
                onClick={handleManualEntry}
                className="text-yellow-500 hover:text-yellow-400 font-medium transition-colors text-sm sm:text-sm"
              >
                Enter details manually
              </button>
            </div>
          </div>
        </div>
      </main>
      {/* Clean Footer */}
      <footer className="bg-gray-900 border-t-4 border-yellow-500 py-4"></footer>
    </div>
  );
}