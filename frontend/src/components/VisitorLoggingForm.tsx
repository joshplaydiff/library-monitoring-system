import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Phone, Clock, LogIn, LogOut, AlertCircle } from 'lucide-react';
import { submitLog, checkUserActive } from '../utils/api';
import { useGlobalRefresh } from '../context/RefreshContext';

interface VisitorLoggingFormProps {
  isOnline: boolean;
  addToQueue: (log: any) => void;
}

export function VisitorLoggingForm({ isOnline, addToQueue }: VisitorLoggingFormProps) {
  const navigate = useNavigate();
  const { triggerRefresh } = useGlobalRefresh();
  const [currentTime, setCurrentTime] = useState(new Date());

  const [formData, setFormData] = useState({
    userType: 'visitor',
    name: '',
    contactNumber: '',
    purpose: '',
    othersPurpose: '',
    logType: 'entry' as 'entry' | 'exit',
    timestamp: new Date().toISOString()
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [existingVisitorId, setExistingVisitorId] = useState<string | null>(null);
  const [isUserActive, setIsUserActive] = useState<boolean | null>(null);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      const storedVisitorId = localStorage.getItem('currentVisitorId');
      if (storedVisitorId && isOnline) {
        setExistingVisitorId(storedVisitorId);
        // Check if the visitor still has an active session
        try {
          const result = await checkUserActive(storedVisitorId);
          if (result.success && result.data) {
            setIsUserActive(true);
            setActiveSession(result.data);
            setFormData(prev => ({ ...prev, logType: 'exit', name: result.data.name || '' }));
          } else {
            setIsUserActive(false);
            // Clear stale data if no active session
            localStorage.removeItem('currentVisitorId');
            localStorage.removeItem('currentVisitorData');
            setExistingVisitorId(null);
          }
        } catch (e) {
          console.error('Error checking visitor session:', e);
        }
      }
    };
    checkExistingSession();
  }, [isOnline]);

  useEffect(() => {
    const storedVisitorId = localStorage.getItem('currentVisitorId');
    const storedVisitorData = localStorage.getItem('currentVisitorData');
    if (storedVisitorId) {
      setExistingVisitorId(storedVisitorId);
    }
    // Pre-fill form with stored visitor data and default to exit mode
    if (storedVisitorData) {
      try {
        const visitorData = JSON.parse(storedVisitorData);
        if (visitorData.name) {
          setFormData(prev => ({ ...prev, name: visitorData.name, logType: 'exit' }));
        }
      } catch (e) {
        console.error('Error parsing visitor data:', e);
      }
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: Record<string, string> = {};
    
    // For entry, we need name and contact number
    if (formData.logType === 'entry') {
      if (!formData.name.trim()) newErrors.name = 'Name is required';
      if (!formData.contactNumber.trim()) newErrors.contactNumber = 'Contact number is required';
      if (!formData.purpose) newErrors.purpose = 'Purpose of visit is required';
      if (formData.purpose === 'others' && !formData.othersPurpose.trim()) {
        newErrors.othersPurpose = 'Please specify your purpose';
      }
    }

    // For exit, validate that we have an active session
    if (formData.logType === 'exit') {
      if (!existingVisitorId) {
        newErrors.logType = 'No active visitor session found. Please check in first.';
      } else if (isUserActive === false) {
        newErrors.logType = 'Your session has expired or you are not logged in. Please check in first.';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Generate a visitor ID (for entry) or use stored ID (for exit)
    let visitorId = existingVisitorId;
    let visitorPassId = existingVisitorId; // The readable ID for visitors
    let finalLogType = formData.logType;
    let finalPurpose = formData.logType === 'exit' ? 'N/A - Exit' : (formData.purpose === 'others' ? formData.othersPurpose : formData.purpose);
    let finalName = formData.name;
    let finalUserType = 'visitor';

    // For entry, generate a proper Visitor Pass ID
    if (formData.logType === 'entry') {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
      visitorPassId = `VP-${dateStr}-${timeStr}`;
      visitorId = visitorPassId;
    }

    // For exit, we need to get the stored visitor data
    if (formData.logType === 'exit' && existingVisitorId) {
      const storedVisitorData = localStorage.getItem('currentVisitorData');
      if (storedVisitorData) {
        try {
          const visitorData = JSON.parse(storedVisitorData);
          finalName = visitorData.name || formData.name;
          finalUserType = visitorData.user_type || 'visitor';
        } catch (e) {
          console.error('Error parsing visitor data:', e);
        }
      }
    }

    // Submit to backend if online
    if (isOnline) {
      const result = await submitLog({
        user_type: finalUserType,
        user_id: visitorId,
        name: finalName,
        purpose: finalPurpose,
        log_type: finalLogType,
        timestamp: formData.timestamp
      });

      if (!result.success) {
        console.error('Failed to submit log:', result.error);
      } else {
        // Trigger refresh for Active Users and Visit Logs and wait for completion
        await Promise.all([
          triggerRefresh('activeUsers'),
          triggerRefresh('visitLogs')
        ]);
      }
    } else {
      // Add to offline queue
      const logEntry = {
        ...formData,
        userId: visitorId,
        id: Date.now().toString(),
        synced: false
      };
      addToQueue(logEntry);
    }

    // Store visitor ID for exit
    if (formData.logType === 'entry') {
      localStorage.setItem('currentVisitorId', visitorId);
      localStorage.setItem('currentVisitorData', JSON.stringify({
        name: formData.name,
        user_type: 'visitor',
        purpose: formData.purpose,
        visitorPassId: visitorPassId
      }));
    } else {
      // Clear stored visitor data on exit
      localStorage.removeItem('currentVisitorId');
      localStorage.removeItem('currentVisitorData');
    }

    // Navigate to success screen
    navigate('/success', { 
      state: { 
        logType: formData.logType,
        isOnline,
        visitorName: formData.name,
        visitorPassId: formData.logType === 'entry' ? visitorPassId : undefined,
        shouldLogout: formData.logType === 'exit'
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
              <span className="text-white font-semibold text-sm sm:text-base">Visitors Pass | Unregistered</span>
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
              Visitors Pass | Unregistered
            </h2>
            
            {/* Active Status Warning */}
            {isCheckingStatus ? (
              <div className="flex items-center space-x-2 text-sm text-gray-600 mt-2">
                <div className="animate-spin w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full"></div>
                <span>Checking session status...</span>
              </div>
            ) : isUserActive === true ? (
              <div className="flex items-start space-x-2 bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
                <LogOut className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800">You are currently logged in</p>
                  <p className="text-xs text-green-600 mt-1">
                    Pass ID: {existingVisitorId || 'N/A'}
                  </p>
                </div>
              </div>
            ) : isUserActive === false && existingVisitorId ? (
              <div className="flex items-start space-x-2 bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Session expired or not found</p>
                  <p className="text-xs text-red-600 mt-1">Please check in again</p>
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
              <div className="block text-sm font-medium text-gray-700 mb-3" id="logType-label">
                Log Type:
              </div>
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
              {errors.logType && (
                <p className="mt-2 text-sm text-red-600">{errors.logType}</p>
              )}
            </div>

            {/* Visitor Pass ID - Show for exit only */}
            {formData.logType === 'exit' && (
              <div>
                <label htmlFor="visitorPassId" className="block text-sm font-semibold text-gray-800 mb-2">
                  Visitor Pass ID (Optional):
                </label>
                <input
                  type="text"
                  id="visitorPassId"
                  autoComplete="off"
                  placeholder="VP-YYYYMMDD-HHMMSS"
                  defaultValue={existingVisitorId || ''}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent font-mono"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Enter your Visitor Pass ID from entry, or use your pre-filled name below
                </p>
              </div>
            )}

            {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-gray-800 mb-2">
                    Full Name: <span className="text-red-500"></span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="name"
                      autoComplete="name"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="Full First and Last Name"
                      className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent ${
                        errors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                  )}
                </div>

                {/* Contact Number */}
                <div>
                  <label htmlFor="contactNumber" className="block text-sm font-semibold text-gray-800 mb-2">
                    Contact Number: <span className="text-red-500"></span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      id="contactNumber"
                      autoComplete="tel"
                      value={formData.contactNumber}
                      onChange={(e) => handleChange('contactNumber', e.target.value)}
                      placeholder="09XXXXXXXXX"
                      className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent ${
                        errors.contactNumber ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {errors.contactNumber && (
                    <p className="mt-1 text-sm text-red-600">{errors.contactNumber}</p>
                  )}
                </div>

                {/* Purpose of Visit - Hide for exit logs */}
                {formData.logType === 'entry' && (
                  <div>
                    <label htmlFor="purpose" className="block text-sm font-semibold text-gray-800 mb-2">
                      Purpose of Visit: <span className="text-red-500"></span>
                    </label>
                    <select
                      id="purpose"
                      autoComplete="off"
                      value={formData.purpose}
                      onChange={(e) => handleChange('purpose', e.target.value)}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent ${
                        errors.purpose ? 'border-red-500' : 'border-gray-300'
                      }`}
                      required
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
                    <label htmlFor="othersPurpose" className="block text-sm font-medium text-gray-700 mb-2">
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
              style={{ 
                backgroundColor: formData.logType === 'exit' ? '#dc2626' : '#eab308',
                color: formData.logType === 'exit' ? '#ffffff' : '#111827'
              }}
              className={`w-full font-semibold py-3 sm:py-4 px-6 rounded-lg shadow-md transform transition-all duration-200 hover:scale-105 text-base sm:text-base ${
                formData.logType === 'exit' ? 'hover:bg-red-700' : 'hover:bg-yellow-600'
              }`}
            >
              {formData.logType === 'exit' ? 'Log Out (Exit)' : 'Register Visit (Entry)'}
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
