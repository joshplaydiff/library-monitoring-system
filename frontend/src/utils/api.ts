const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Check if online before making requests
function checkOnline(): boolean {
  if (!navigator.onLine) {
    return false;
  }
  return true;
}

// Helper function to safely parse JSON responses
async function safeJsonParse(response: Response): Promise<any> {
  try {
    const text = await response.text();
    
    // Check if response is HTML (error page) instead of JSON
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      throw new Error(`Server returned HTML error page (Status: ${response.status}). Backend server may not be running or API endpoint not found.`);
    }
    
    // Try to parse as JSON
    return JSON.parse(text);
  } catch (parseError) {
    if (parseError instanceof SyntaxError) {
      throw new Error(`Invalid JSON response from server (Status: ${response.status}). Backend may be returning an error page.`);
    }
    throw parseError;
  }
}

interface LogEntry {
  id?: string;
  user_id?: string;
  name?: string;
  user_type?: string;
  department?: string;
  purpose: string;
  section?: string;
  room_id?: number;
  log_type: 'entry' | 'exit';
  timestamp?: string;
}

interface ApiResponse<T> {
  active: boolean;
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  debug?: string;
}

// Submit a new log entry
export async function submitLog(log: LogEntry): Promise<ApiResponse<any>> {
  if (!checkOnline()) {
    return { success: false, error: 'No internet connection. Log queued for sync.' };
  }
  
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/logs`, {
      method: 'POST',
      headers,
      body: JSON.stringify(log)
    });

    const data = await safeJsonParse(response);
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to submit log');
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error submitting log:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Sync multiple logs from offline queue
export async function syncLogs(logs: LogEntry[]): Promise<ApiResponse<any>> {
  if (!checkOnline()) {
    return { success: false, error: 'No internet connection. Cannot sync.' };
  }
  
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/logs/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ logs })
    });

    const data = await safeJsonParse(response);
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to sync logs');
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error syncing logs:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Get all logs with optional filters
export async function getLogs(filters?: {
  user_type?: string;
  purpose?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  page?: number;
}): Promise<ApiResponse<LogEntry[]>> {
  try {
    const queryParams = new URLSearchParams();
    if (filters?.user_type) queryParams.append('user_type', filters.user_type);
    if (filters?.purpose) queryParams.append('purpose', filters.purpose);
    if (filters?.startDate) queryParams.append('startDate', filters.startDate);
    if (filters?.endDate) queryParams.append('endDate', filters.endDate);
    if (filters?.limit) queryParams.append('limit', filters.limit.toString());
    if (filters?.page) queryParams.append('page', filters.page.toString());

    const url = `${BASE_URL}/logs${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(url, { headers });

    const result = await safeJsonParse(response);

    if (!response.ok) {
      throw new Error(result.error || 'Failed to fetch logs');
    }

    return { success: true, data: result.data || result };
  } catch (error) {
    console.error('Error fetching logs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Get analytics data
export async function getAnalytics(period: 'day' | 'week' | 'month' = 'week', section?: string, room_id?: string): Promise<ApiResponse<any>> {
  try {
    const params = new URLSearchParams({ period });
    if (section) params.append('section', section);
    if (room_id) params.append('room_id', room_id);

    const response = await fetch(`${BASE_URL}/logs/analytics?${params.toString()}`);
    
    const data = await safeJsonParse(response);
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch analytics');
    }

    return { success: true, data: data.data };
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Get active users currently in the library
export async function getActiveUsers(): Promise<ApiResponse<any[]>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/logs/active-users`, { headers });

    const data = await safeJsonParse(response);

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch active users');
    }

    // Extract the actual data from the response (backend returns { success, data })
    const users = data.data || data;
    return { success: true, data: Array.isArray(users) ? users : [] };
  } catch (error) {
    console.error('Error fetching active users:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Check if a specific visitor has an active session
export async function checkVisitorActiveSession(visitorId: string): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/logs/active-session?visitorId=${encodeURIComponent(visitorId)}`, { headers });

    const data = await safeJsonParse(response);

    if (!response.ok) {
      throw new Error(data.error || 'Failed to check active session');
    }

    return {
      success: true,
      active: data.active,
      data: data.data
    };
  } catch (error) {
    console.error('Error checking active session:', error);
    return {
      success: false,
      active: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Check if a specific user is currently active
export async function checkUserActive(userId: string): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/logs/active-session?visitorId=${encodeURIComponent(userId)}`, { headers });

    const data = await safeJsonParse(response);

    if (!response.ok) {
      throw new Error(data.error || 'Failed to check user status');
    }

    return { success: true, data: data.data || null };
  } catch (error) {
    console.error('Error checking user status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Manual logout for a user
export async function manualLogout(userId: string): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}/logs/logout/${userId}`, {
      method: 'POST',
      headers,
    });

    const data = await safeJsonParse(response);

    if (!response.ok) {
      throw new Error(data.error || 'Failed to logout user');
    }

    return { success: true, data: data.data, message: data.message };
  } catch (error) {
    console.error('Error logging out user:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Get single user by ID
export async function getUserById(userId: string): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${BASE_URL}/registered-users/${userId}`);
    const data = await safeJsonParse(response);
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch user');
    }
    
    return { success: true, data: data.data };
  } catch (error) {
    console.error('Error fetching user:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Health check
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/health/health`);
    const data = await safeJsonParse(response);
    return data.status === 'ok';
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}

// Login for students/library users
export async function loginUser(data: { student_id: string; password: string }): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${BASE_URL}/auth/login/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await safeJsonParse(response);
    if (!response.ok) {
      throw new Error(result.error || 'Failed to login');
    }
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error logging in user:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Password reset - request a reset token (no new_password sent)
export async function requestPasswordReset(data: { student_id: string; email: string }): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await safeJsonParse(response);
    if (!response.ok) {
      throw new Error(result.error || 'Failed to request password reset');
    }
    return { success: true, data: result.data, message: result.message };
  } catch (error) {
    console.error('Error requesting password reset:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Password reset - consume a valid token and set new password
export async function resetPasswordWithToken(data: { reset_token: string; new_password: string }): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await safeJsonParse(response);
    if (!response.ok) {
      throw new Error(result.error || 'Failed to reset password');
    }
    return { success: true, data: result.data, message: result.message };
  } catch (error) {
    console.error('Error resetting password with token:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Forgot password - legacy endpoint (kept for reference; use requestPasswordReset instead)
export async function forgotPassword(data: { student_id: string; email: string; new_password: string }): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await safeJsonParse(response);
    if (!response.ok) {
      throw new Error(result.error || 'Failed to reset password');
    }
    return { success: true, data: result.data, message: result.message };
  } catch (error) {
    console.error('Error resetting password:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function borrowBook(data: { book_id: number; due_date?: string }): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/transactions/borrow`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to borrow book');
    return { success: true, data: result.data, message: result.message };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function returnBook(transactionId: number): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/transactions/return/${transactionId}`, {
      method: 'POST',
      headers
    });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.message || result.error || 'Failed to return book');
    return { success: true, data: result.data, message: result.message };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function renewBook(transactionId: number, days = 7): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/transactions/renew/${transactionId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ days })
    });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to renew book');
    return { success: true, data: result.data, message: result.message };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function reserveBook(data: { book_id: number; preferred_date?: string; notes?: string }): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/transactions/reserve`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to reserve book');
    return { success: true, data: result.data, message: result.message };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getMyTransactions(): Promise<ApiResponse<any[]>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/transactions/my/transactions`, { headers });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to fetch transactions');
    return { success: true, data: result.data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getMyReservations(): Promise<ApiResponse<any[]>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/transactions/my/reservations`, { headers });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to fetch reservations');
    return { success: true, data: result.data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getAdminTransactions(filters?: { status?: string; user_id?: number; book_id?: number; transaction_type?: string; page?: number; limit?: number }): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.user_id) params.append('user_id', String(filters.user_id));
    if (filters?.book_id) params.append('book_id', String(filters.book_id));
    if (filters?.transaction_type) params.append('transaction_type', filters.transaction_type);
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));

    const response = await fetch(`${BASE_URL}/transactions/transactions?${params.toString()}`, { headers });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to fetch transactions');
    return { success: true, data: result.data, pagination: result.pagination };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function approveTransaction(transactionId: number): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/transactions/transactions/${transactionId}/approve`, { method: 'POST', headers });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to approve');
    return { success: true, data: result.data, message: result.message };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function rejectTransaction(transactionId: number, reason?: string): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/transactions/transactions/${transactionId}/reject`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason })
    });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to reject');
    return { success: true, data: result.data, message: result.message };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function createFine(data: { user_id: number; book_id?: number; transaction_id?: number; amount: number; reason?: string }): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/transactions/fines`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to create fine');
    return { success: true, data: result.data, message: result.message };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getFines(filters?: { user_id?: number; status?: string; page?: number; limit?: number }): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const params = new URLSearchParams();
    if (filters?.user_id) params.append('user_id', String(filters.user_id));
    if (filters?.status) params.append('status', filters.status);
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));

    const response = await fetch(`${BASE_URL}/transactions/fines?${params.toString()}`, { headers });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to fetch fines');
    return { success: true, data: result.data, pagination: result.pagination };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function clearFine(fineId: number): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/transactions/fines/${fineId}/clear`, { method: 'POST', headers });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to clear fine');
    return { success: true, data: result.data, message: result.message };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function updateReservationStatus(reservationId: number, status: string): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/transactions/reservations/${reservationId}/status`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ status })
    });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to update reservation');
    return { success: true, data: result.data, message: result.message };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getNotifications(): Promise<ApiResponse<any[]>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/transactions/notifications`, { headers });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to fetch notifications');
    return { success: true, data: result.data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Registered Users API functions
export async function getRegisteredUsers(): Promise<ApiResponse<any[]>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/registered-users`, { headers });
    const data = await safeJsonParse(response);
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch registered users');
    }
    
    // Extract the actual data from the response (backend returns { success, data, pagination })
    const users = data.data || data;
    return { success: true, data: Array.isArray(users) ? users : [] };
  } catch (error) {
    console.error('Error fetching registered users:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function getRegisteredUsersStats(): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/registered-users/stats`, { headers });
    const data = await safeJsonParse(response);
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch registered users stats');
    }
    
    return { success: true, data: data };
  } catch (error) {
    console.error('Error fetching registered users stats:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function resolveUserByOfficialId(official_id: string, id_type: string): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/logs/resolve-user?official_id=${encodeURIComponent(official_id)}&id_type=${encodeURIComponent(id_type)}`, { headers });
    const data = await safeJsonParse(response);

    if (!response.ok) {
      throw new Error(data.error || 'Failed to resolve patron');
    }

    return { success: true, data: data.data || data };
  } catch (error) {
    console.error('Error resolving patron by official ID:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function getRegisteredUserById(userId: number): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/registered-users/${userId}`, { headers });
    const data = await safeJsonParse(response);

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch user');
    }

    return { success: true, data: data.data || data };
  } catch (error) {
    console.error('Error fetching registered user by ID:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function deleteRegisteredUser(userId: number): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/registered-users/${userId}`, {
      method: 'DELETE',
      headers
    });
    const data = await safeJsonParse(response);

    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete registered user');
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error deleting registered user:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function updateRegisteredUser(userId: number, userData: Partial<RegisteredUser>): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/registered-users/${userId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(userData)
    });
    const data = await safeJsonParse(response);
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to update registered user');
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Error updating registered user:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function importRegisteredUsers(file: File, batchId: string, importedBy: string): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('batch_id', batchId);
    formData.append('imported_by', importedBy);
    
    const response = await fetch(`${BASE_URL}/registered-users/import`, {
      method: 'POST',
      headers,
      body: formData
    });
    const data = await safeJsonParse(response);
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to import registered users');
    }
    
    return { success: true, data: data.data, message: data.message };
  } catch (error) {
    console.error('Error importing registered users:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function getImportBatches(): Promise<ApiResponse<any[]>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/registered-users/import-batches`, { headers });
    const data = await safeJsonParse(response);
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch import batches');
    }
    
    return { success: true, data: Array.isArray(data) ? data : [] };
  } catch (error) {
    console.error('Error fetching import batches:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Get historical analytics data for comparison
export async function getHistoricalAnalytics(
  comparisonType: 'week-over-week' | 'month-over-month' | 'year-over-year',
  referenceDate?: string
): Promise<ApiResponse<any>> {
  try {
    const params = new URLSearchParams();
    params.append('comparisonType', comparisonType);
    if (referenceDate) {
      params.append('referenceDate', referenceDate);
    }
    
    const response = await fetch(`${BASE_URL}/logs/analytics/historical?${params.toString()}`);
    const data = await safeJsonParse(response);
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch historical analytics');
    }
    
    return { success: true, data: data.data };
  } catch (error) {
    console.error('Error fetching historical analytics:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Get trend data for long-term visualization
export async function getTrendAnalytics(
  period: 'week' | 'month' | 'year',
  count: number = 12,
  referenceDate?: string
): Promise<ApiResponse<any>> {
  try {
    const params = new URLSearchParams();
    params.append('period', period);
    params.append('count', count.toString());
    if (referenceDate) {
      params.append('referenceDate', referenceDate);
    }
    
    const response = await fetch(`${BASE_URL}/logs/analytics/trends?${params.toString()}`);
    const data = await safeJsonParse(response);
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch trend analytics');
    }
    
    return { success: true, data: data.data };
  } catch (error) {
    console.error('Error fetching trend analytics:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Get capacity planning analytics
export async function getCapacityAnalytics(
  period: 'week' | 'month' | 'year' = 'month'
): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${BASE_URL}/logs/analytics/capacity?period=${period}`);
    const data = await safeJsonParse(response);
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch capacity analytics');
    }
    
    return { success: true, data: data.data };
  } catch (error) {
    console.error('Error fetching capacity analytics:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Get user engagement scoring analytics
export async function getEngagementAnalytics(
  minVisits: number = 2,
  daysBack: number = 30
): Promise<ApiResponse<any>> {
  try {
    const params = new URLSearchParams();
    params.append('minVisits', minVisits.toString());
    params.append('daysBack', daysBack.toString());
    
    const response = await fetch(`${BASE_URL}/logs/analytics/engagement?${params.toString()}`);
    const data = await safeJsonParse(response);
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch engagement analytics');
    }
    
    return { success: true, data: data.data };
  } catch (error) {
    console.error('Error fetching engagement analytics:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Interfaces for registered users
export interface RegisteredUser {
  id?: number;
  student_id: string;
  full_name: string;
  department?: string;
  program_designation?: string;
  year_level_status?: string;
  import_date?: string;
}

export interface ImportBatch {
  id: string;
  filename: string;
  status: string;
  total_records: number;
  successful_imports: number;
  failed_imports: number;
  imported_by: string;
  import_date: string;
}

// Get analytics data for export with custom date range
export async function getAnalyticsForExport(
  dateRange: string,
  customStartDate?: string,
  customEndDate?: string
): Promise<ApiResponse<any>> {
  try {
    const params = new URLSearchParams();
    params.append('period', dateRange);
    if (customStartDate) {
      params.append('startDate', customStartDate);
    }
    if (customEndDate) {
      params.append('endDate', customEndDate);
    }
    
    const response = await fetch(`${BASE_URL}/logs/analytics?${params.toString()}`);
    const data = await safeJsonParse(response);
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch analytics for export');
    }
    
    return { success: true, data: data.data };
  } catch (error) {
    console.error('Error fetching analytics for export:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Export analytics to Excel format
export async function exportAnalyticsToExcel(
  analytics: any,
  options: {
    reportType: string;
    dateRange: string;
    includeCharts: boolean;
    includeRecommendations: boolean;
  }
): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/export/excel`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        analytics,
        options
      })
    });
    
    if (!response.ok) {
      const data = await safeJsonParse(response);
      throw new Error(data.error || 'Failed to export to Excel');
    }
    
    // Handle blob response for file download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `library-analytics-${options.dateRange}-${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    return { success: true, message: 'Excel report exported successfully' };
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Export analytics to PDF format
export async function exportAnalyticsToPDF(
  analytics: any,
  options: {
    reportType: string;
    dateRange: string;
    includeCharts: boolean;
    includeRecommendations: boolean;
  }
): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/export/pdf`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        analytics,
        options
      })
    });
    
    if (!response.ok) {
      const data = await safeJsonParse(response);
      throw new Error(data.error || 'Failed to export to PDF');
    }
    
    // Handle blob response for file download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `library-analytics-${options.dateRange}-${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    return { success: true, message: 'PDF report exported successfully' };
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function getPredictions(days = 7): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/predictions?days=${days}`, { headers });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to fetch predictions');
    return { success: true, data: result.data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function createSuggestion(data: { title: string; author: string; isbn?: string; notes?: string }): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/suggestions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to submit suggestion');
    return { success: true, data: result.data, message: result.message };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getMySuggestions(): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/suggestions/my`, { headers });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to fetch suggestions');
    return { success: true, data: result.data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function createRoomReservation(data: { room_id: number; purpose?: string; reservation_date: string; start_time: string; end_time: string }): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/room-reservations`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to create reservation');
    return { success: true, data: result.data, message: result.message };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getMyRoomReservations(): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/room-reservations/my`, { headers });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to fetch reservations');
    return { success: true, data: result.data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function waiveFine(fineId: number, reason?: string): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/transactions/fines/${fineId}/waive`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason })
    });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to waive fine');
    return { success: true, data: result.data, message: result.message };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Cataloging API types
export interface CatalogRecord {
  id?: number;
  title: string;
  author: string;
  author_type?: string;
  added_author?: string;
  editor?: string;
  publisher?: string;
  publication_place?: string;
  publication_date?: string;
  edition?: string;
  pages?: string;
  illustrations?: string;
  dimensions?: string;
  series_title?: string;
  series_volume?: string;
  series_issue?: string;
  isbn?: string;
  issn?: string;
  oclc_number?: string;
  local_call_number?: string;
  accession_number?: string;
  subject_headings?: string;
  keywords?: string;
  dewey_decimal?: string;
  library_of_congress?: string;
  general_notes?: string;
  bibliography_notes?: string;
  table_of_contents?: string;
  summary?: string;
  material_type?: string;
  language?: string;
  cataloging_source?: string;
  cataloger?: string;
  cataloging_date?: string;
  status?: string;
  copies_total?: number;
  copies_available?: number;
}

// Get catalog records with optional filters
export async function getCatalogRecords(filters?: {
  search?: string;
  author?: string;
  subject?: string;
  material_type?: string;
  status?: string;
  dewey_decimal?: string;
  page?: number;
  limit?: number;
}): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.author) params.append('author', filters.author);
    if (filters?.subject) params.append('subject', filters.subject);
    if (filters?.material_type) params.append('material_type', filters.material_type);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.dewey_decimal) params.append('dewey_decimal', filters.dewey_decimal);
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));

    const response = await fetch(`${BASE_URL}/cataloging?${params.toString()}`, { headers });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to fetch catalog records');
    return { success: true, data: result.data, pagination: result.pagination };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Get single catalog record by ID
export async function getCatalogRecord(id: number): Promise<ApiResponse<CatalogRecord>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/cataloging/${id}`, { headers });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to fetch catalog record');
    return { success: true, data: result.data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Create new catalog record
export async function createCatalogRecord(data: Partial<CatalogRecord>): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/cataloging`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to create catalog record');
    return { success: true, data: result.data, message: result.message };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Update catalog record
export async function updateCatalogRecord(id: number, data: Partial<CatalogRecord>): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/cataloging/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data)
    });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to update catalog record');
    return { success: true, data: result.data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Delete catalog record
export async function deleteCatalogRecord(id: number): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/cataloging/${id}`, { method: 'DELETE', headers });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to delete catalog record');
    return { success: true, message: result.message };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Get catalog statistics
export async function getCatalogStats(): Promise<ApiResponse<any>> {
  try {
    const token = localStorage.getItem('userToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/cataloging/stats/overview`, { headers });
    const result = await safeJsonParse(response);
    if (!response.ok) throw new Error(result.error || 'Failed to fetch catalog statistics');
    return { success: true, data: result.data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

