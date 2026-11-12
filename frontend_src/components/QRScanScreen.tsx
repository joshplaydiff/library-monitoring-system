import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, ArrowLeft, CheckCircle, XCircle, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { AppFooter } from './AppFooter';
import { checkVisitorActiveSession, submitLog } from '../utils/api';

interface QRScanScreenProps {
  isOnline: boolean;
}

export function QRScanScreen({ isOnline }: QRScanScreenProps) {
  const navigate = useNavigate();
  const [scanStatus, setScanStatus] = useState<'scanning' | 'success' | 'error' | null>('scanning');
  const [message, setMessage] = useState('');
  const [showScanner, setShowScanner] = useState(true);
  const [processing, setProcessing] = useState(false);
  const lastScannedValue = useRef<string | null>(null);
  const lastScanTime = useRef<number>(0);

  const handleScan = async (detectedCodes: any[]) => {
    if (processing) return;
    if (!detectedCodes || detectedCodes.length === 0) return;

    const { rawValue } = detectedCodes[0];
    const now = Date.now();

    if (lastScannedValue.current === rawValue && now - lastScanTime.current < 3000) {
      return;
    }

    lastScannedValue.current = rawValue;
    lastScanTime.current = now;
    setProcessing(true);
    setShowScanner(false);

    try {
      let qrData: any = {};
      try {
        qrData = JSON.parse(rawValue);
      } catch {
        qrData = { student_id: rawValue, name: 'Unknown', user_type: 'student', purpose: 'General' };
      }

      const userId = String(qrData.student_id || qrData.user_id || rawValue);
      const name = String(qrData.name || 'Unknown');
      const userType = String(qrData.user_type || 'student');
      const purpose = String(qrData.purpose || 'General');

      const sessionResult = await checkVisitorActiveSession(userId);
      const hasActiveSession = sessionResult.success && sessionResult.active;
      const logType: 'entry' | 'exit' = hasActiveSession ? 'exit' : 'entry';

      const logResult = await submitLog({
        user_id: qrData.user_id ? Number(qrData.user_id) : undefined,
        student_id: qrData.student_id,
        name,
        user_type: userType,
        purpose,
        log_type: logType
      });

      if (logResult.success) {
        setScanStatus('success');
        setMessage(`${logType === 'entry' ? 'Entry' : 'Exit'} Success! Welcome${logType === 'exit' ? ' back' : ''}.`);
      } else {
        setScanStatus('error');
        setMessage(logResult.error || 'Failed to record attendance');
      }
    } catch (error) {
      setScanStatus('error');
      setMessage('Failed to process QR code');
    } finally {
      setProcessing(false);
    }
  };

  const handleError = (error: any) => {
    console.error('QR Scanner error:', error);
    setScanStatus('error');
    
    // Provide user-friendly error messages based on error type
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
    lastScannedValue.current = null;
    lastScanTime.current = 0;
  };

  const handleManualEntry = () => {
    navigate('/admin/visit-logs');
  };

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
                  <span className="text-xs sm:text-sm text-yellow-400">Offline</span>
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
              Scan visitor or student QR code to log entry or exit
            </p>
          </div>

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

              {/* Success State */}
              {!showScanner && scanStatus === 'success' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-900 bg-opacity-20">
                  <CheckCircle className="w-16 h-16 sm:w-20 sm:h-20 text-green-400 mb-3 sm:mb-4" />
                  <p className="text-green-400 font-semibold text-base sm:text-lg text-center px-2">{message}</p>
                </div>
              )}

              {/* Error State */}
              {!showScanner && scanStatus === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900 bg-opacity-20">
                  <XCircle className="w-16 h-16 sm:w-20 sm:h-20 text-red-400 mb-3 sm:mb-4" />
                  <p className="text-red-400 font-semibold text-base sm:text-lg text-center px-2">{message}</p>
                </div>
              )}
            </div>

            {/* Offline Mode Indicator */}
            {!isOnline && (
              <div className="mt-3 sm:mt-4 bg-yellow-500 bg-opacity-20 border border-yellow-500 rounded-lg p-3">
                <p className="text-yellow-400 text-xs sm:text-sm text-center">
                  <WifiOff className="w-3 h-3 sm:w-4 sm:h-4 inline mr-2" />
                  Offline mode: Data will sync when connection is restored
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
                <span>Scan Next</span>
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
