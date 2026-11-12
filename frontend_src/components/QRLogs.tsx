import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Clock, LogOut, AlertCircle, LogIn } from 'lucide-react';
import { submitLog, getUserById, checkUserActive } from '../utils/api';

interface QRLogsProps {
  isOnline: boolean;
  addToQueue: (log: any) => void;
}

export function QRLogs({ isOnline, addToQueue }: QRLogsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const modeParam = searchParams.get('mode') as string | null;
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [userFound, setUserFound] = useState<boolean | null>(null);
  const [isUserActive, setIsUserActive] = useState<boolean | null>(null);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const [formData, setFormData] = useState({
    userId: '',
    name: '',
    purpose: '',
    othersPurpose: '',
    logType: 'entry' as 'entry' | 'exit',
    userType: 'visitor',
    timestamp: new Date().toISOString()
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      const userDataStr = localStorage.getItem('currentUserData');
      if (userDataStr && isOnline) {
        try {
          const userData = JSON.parse(userDataStr);
          const result = await checkUserActive(userData.userId);
          if (result.success && result.data) {
            setIsUserActive(true);
            setActiveSession(result.data);
          }
        } catch (e) {}
      }
    };
    checkExistingSession();
  }, []);

  // Auto-fill ID Number from QR code scan and fetch user data
  useEffect(() => {
    if (location.state?.qrData) {
      setFormData(prev => ({
        ...prev,
        userId: location.state.qrData
      }));
      
      // Fetch user data from database
      fetchUserData(location.state.qrData);
      
      // Set form mode from URL param
      if (modeParam === 'exit') {
        handleChange('logType', 'exit');
      }
      
      // Check if user is active (for auto mode or exit mode)
      if (!modeParam || modeParam === 'auto' || modeParam === 'exit') {
        checkActiveStatus(location.state.qrData);
      }
    }
  }, [location.state?.qrData]);

  const checkActiveStatus = async (userId: string) => {
    setIsCheckingStatus(true);
    try {
      const result = await checkUserActive(userId);
      if (result.success && result.data) {
        setIsUserActive(true);
        setActiveSession(result.data);
      } else {
        setIsUserActive(false);
        setActiveSession(null);
      }
    } catch (error) {
      console.error('Error checking user status:', error);
      setIsUserActive(false);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const fetchUserData = async (userId: string) => {
    setIsLoadingUser(true);
    try {
      const result = await getUserById(userId);
      if (result.success && result.data) {
        setFormData(prev => ({
          ...prev,
          name: result.data.full_name || '',
          userType: 'student'
        }));
        setUserFound(true);
      } else {
        setUserFound(false);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUserFound(false);
    } finally {
      setIsLoadingUser(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Determine log type based on form toggle
    const logType = formData.logType || 'entry';
    
    // Validation for userId
    const newErrors: Record<string, string> = {};
    if (!formData.userId || formData.userId.trim() === '') {
      newErrors.userId = 'ID Number is required';
      setErrors(newErrors);
      return;
    }
    
    // For entry logs, we need purpose validation
    if (logType === 'entry') {
      // Validation for entry
      if (!formData.purpose) newErrors.purpose = 'Purpose of visit is required';
      if (formData.purpose === 'others' && !formData.othersPurpose.trim()) {
        newErrors.othersPurpose = 'Please specify your purpose';
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }
    }

    // Submit to backend if online
    const finalPurpose = logType === 'exit' ? 'N/A - Exit' : (formData.purpose === 'others' ? formData.othersPurpose : formData.purpose);
    if (isOnline) {
      const result = await submitLog({
        user_id: formData.userId,
        name: formData.name,
        user_type: formData.userType || 'visitor',
        purpose: finalPurpose,
        log_type: logType,
        timestamp: formData.timestamp
      });

      if (!result.success) {
        console.error('Failed to submit log:', result.error);
        // Still continue to show success - will be handled by offline queue
      }
    } else {
      // Add to offline queue
      const logEntry = {
        user_id: formData.userId,
        name: formData.name,
        user_type: formData.userType || 'visitor',
        purpose: finalPurpose,
        log_type: logType,
        timestamp: formData.timestamp,
        id: Date.now().toString(),
        synced: false
      };
      addToQueue(logEntry);
    }

    // Store user session data for exit validation
    if (logType === 'entry') {
      localStorage.setItem('currentUserData', JSON.stringify({
        userId: formData.userId,
        name: formData.name,
        userType: formData.userType || 'visitor',
        purpose: formData.purpose
      }));
    } else {
      localStorage.removeItem('currentUserData');
    }

    // Navigate to success screen
    navigate('/success', { 
      state: { 
        logType: logType,
        isOnline,
        userName: formData.name,
        shouldLogout: logType === 'exit'
      } 
    });
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col">

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
              <span className="text-white font-semibold text-sm sm:text-base">QR Visit Logging</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12 relative z-10">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 space-y-4 sm:space-y-6">
          {/* Form Header */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              QR Visit Logging
            </h2>
            
            {/* Active Status Warning */}
            {isCheckingStatus ? (
              <div className="flex items-center space-x-2 text-sm text-gray-600 mt-2">
                <div className="animate-spin w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full"></div>
                <span>Checking status...</span>
              </div>
            ) : isUserActive === true ? (
              <div className="flex items-start space-x-2 bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
                <LogOut className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800">You are currently logged in</p>
                  <p className="text-xs text-green-600 mt-1">
                    Entry time: {activeSession?.entry_time || 'N/A'} | Purpose: {activeSession?.purpose || 'N/A'}
                  </p>
                </div>
              </div>
            ) : isUserActive === false ? (
              <div className="flex items-start space-x-2 bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-800">Ready to log entry</p>
                  <p className="text-xs text-blue-600 mt-1">Not currently in the library</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-sm text-gray-600 mt-2">
                <Clock className="w-4 h-4" />
                <span>{currentTime.toLocaleString('en-US', { 
                  dateStyle: 'medium', 
                  timeStyle: 'medium' 
                })}</span>
              </div>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Entry/Exit Toggle */}
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-3">
                Log Type:
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  aria-label="Log Type: Entry"
                  onClick={() => handleChange('logType', 'entry')}
                  className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-lg border-2 transition-all ${
                    formData.logType === 'entry'
                      ? 'bg-yellow-50 border-yellow-500 text-yellow-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  <LogIn className="w-5 h-5" />
                  <span className="text-sm font-medium">Entry</span>
                </button>
                <button
                  type="button"
                  aria-label="Log Type: Exit"
                  onClick={() => handleChange('logType', 'exit')}
                  className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-lg border-2 transition-all ${
                    formData.logType === 'exit'
                      ? 'bg-red-50 border-red-500 text-red-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm font-medium">Exit</span>
                </button>
              </div>
            </div>

            {/* ID Number (read-only for QR) */}
            <div>
                <label htmlFor="userId" className="block text-sm font-semibold text-gray-800 mb-2">
                  ID Number
                </label>
                <div id="userId" className="w-full px-4 py-3 border border-gray-200 bg-gray-50 rounded-lg text-gray-700">
                  {formData.userId || 'Scanning...'}
                </div>
                {/* User not found message - show under ID Number box */}
                {!isLoadingUser && userFound === false && formData.userId && (
                  <p className="mt-2 text-sm text-red-600">
                    User not found in database. Please enter details manually.
                  </p>
                )}
              </div>
            
            {/* Name (read-only for QR) */}
              <div>
                <span className="block text-sm font-semibold text-gray-800 mb-2">
                  Name:
                </span>
                {formData.name ? (
                  <div className="w-full px-4 py-3 border border-gray-200 bg-gray-50 rounded-lg text-gray-700">
                    {formData.name}
                  </div>
                ) : (
                  <div className="w-full px-4 py-3 border border-gray-200 bg-gray-50 rounded-lg text-gray-400">
                    Scanning...
                  </div>
                )}
              </div>

            {/* Purpose of Visit - Hide for exit logs */}
            {formData.logType === 'entry' && (
              <div>
                  <label htmlFor="purpose" className="block text-sm font-semibold text-gray-800 mb-2">
                    Purpose of Visit <span className="text-red-500"></span>
                  </label>
                  <select
                    id="purpose"
                    value={formData.purpose}
                    onChange={(e) => handleChange('purpose', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent ${
                      errors.purpose ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="" disabled>Select purpose...</option>
                    <option value="study">Study</option>
                    <option value="research">Research</option>
                    <option value="borrow">Borrow Books</option>
                    <option value="return">Return Books</option>
                    <option value="reading">Reading</option>
                    <option value="others">Others</option>
                  </select>
                  {errors.purpose && (
                    <p className="mt-1 text-sm text-red-600">{errors.purpose}</p>
                  )}
              </div>
            )}

            {/* Others Purpose (conditional) */}
            {formData.logType === 'entry' && formData.purpose === 'others' && (
              <div>
                <label htmlFor="othersPurpose" className="block text-sm font-semibold text-gray-800 mb-2">
                  Please specify:
                </label>
                <input
                  type="text"
                  id="othersPurpose"
                  autoComplete="off"
                  value={formData.othersPurpose}
                  onChange={(e) => handleChange('othersPurpose', e.target.value)}
                  placeholder="Enter your specific purpose"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent ${
                    errors.othersPurpose ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.othersPurpose && (
                  <p className="mt-1 text-sm text-red-600">{errors.othersPurpose}</p>
                )}
              </div>
            )}

            {/* Offline Warning */}
            {!isOnline && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Offline Mode:</strong> Your log will be stored locally and synced automatically when internet connection is restored.
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isCheckingStatus || !formData.userId}
              style={{ 
                backgroundColor: formData.logType === 'exit' ? '#dc2626' : '#eab308',
                color: formData.logType === 'exit' ? '#ffffff' : '#111827'
              }}
              className={`w-full font-semibold py-3 sm:py-4 px-6 rounded-lg shadow-md transform transition-all duration-200 hover:scale-105 text-base sm:text-base ${
                isCheckingStatus || !formData.userId ? 'opacity-50 cursor-not-allowed' : (formData.logType === 'exit' ? 'hover:bg-red-700' : 'hover:bg-yellow-600')
              }`}
            >
              {isCheckingStatus 
                ? 'Checking...' 
                : formData.logType === 'exit'
                  ? 'Log Out (Exit)'
                  : 'Submit Log (Entry)'
              }
            </button>
          </form>
        </div>
        </div>
      </main>
      {/* Clean Footer */}
      <footer className="bg-gray-900 border-t-4 border-yellow-500 py-4"></footer>
    </div>
  );
}
