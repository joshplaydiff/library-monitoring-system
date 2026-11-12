import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, QrCode, History, Download, BookOpen, LogOut, BookMarked, Search, Filter, Plus, X, Tag, Bell } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getRegisteredUsers, submitLog, borrowBook, returnBook, renewBook, reserveBook, getMyTransactions, getMyReservations, getNotifications } from '../utils/api';

export function UserPortal() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qrGenerated, setQrGenerated] = useState(false);
  const [books, setBooks] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [borrowMode, setBorrowMode] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rooms, setRooms] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [suggestionForm, setSuggestionForm, ] = useState({ title: '', author: '', isbn: '', notes: '' });

  const purposes = [
    'Borrowing Books',
    'Study',
    'Research',
    'Computer Use',
    'Group Discussion',
    'Other'
  ];

  useEffect(() => {
    const userData = localStorage.getItem('currentUserData');
    if (userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (purpose === 'Borrowing Books' && user?.userId) {
      fetchBooks();
      fetchMyTransactions();
      fetchMyReservations();
    }
  }, [purpose, user?.userId]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    fetch('http://localhost:8000/api/rooms')
      .then(res => res.json())
      .then(result => {
        if (result.success) setRooms(result.data || []);
      })
      .catch(err => console.error('Failed to fetch rooms:', err));
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchBooks = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/books');
      const result = await response.json();
      if (result.success) {
        setBooks(result.data.filter((b: any) => b.available_copies > 0) || []);
      }
    } catch (error) {
      console.error('Failed to fetch books:', error);
    }
  };

  const fetchMyTransactions = async () => {
    const result = await getMyTransactions();
    if (result.success) {
      setTransactions(result.data || []);
    }
  };

  const fetchMyReservations = async () => {
    const result = await getMyReservations();
    if (result.success) {
      setReservations(result.data || []);
    }
  };

  const loadNotifications = async () => {
    const result = await getNotifications();
    if (result.success) setNotifications(result.data || []);
  };

  const handleBorrowRequest = async (bookId: number) => {
    setActionLoading(true);
    const result = await borrowBook({ book_id: bookId });
    if (result.success) {
      setNotification({ type: 'success', message: result.message || 'Borrow request submitted' });
      fetchBooks();
      fetchMyTransactions();
    } else {
      setNotification({ type: 'error', message: result.error || 'Failed to borrow book' });
    }
    setActionLoading(false);
  };

  const handleReserveRequest = async (bookId: number) => {
    setActionLoading(true);
    const result = await reserveBook({ book_id: bookId });
    if (result.success) {
      setNotification({ type: 'success', message: result.message || 'Reservation submitted' });
      fetchBooks();
      fetchMyReservations();
    } else {
      setNotification({ type: 'error', message: result.error || 'Failed to reserve book' });
    }
    setActionLoading(false);
  };

  const handleSubmitSuggestion = async () => {
    if (!suggestionForm.title || !suggestionForm.author) {
      setNotification({ type: 'error', message: 'Please fill in at least title and author' });
      return;
    }
    setActionLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...suggestionForm, user_id: user.userId })
      });
      const result = await response.json();
      if (result.success) {
        setNotification({ type: 'success', message: 'Suggestion submitted for review' });
        setShowSuggestionModal(false);
        setSuggestionForm({ title: '', author: '', isbn: '', notes: '' });
      } else {
        setNotification({ type: 'error', message: result.error || 'Failed to submit suggestion' });
      }
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to submit suggestion' });
    }
    setActionLoading(false);
  };

  const handleReturn = async (transactionId: number) => {
    setActionLoading(true);
    const result = await returnBook(transactionId);
    if (result.success) {
      setNotification({ type: 'success', message: result.message || 'Book returned' });
      fetchMyTransactions();
      fetchBooks();
    } else {
      setNotification({ type: 'error', message: result.error || 'Failed to return book' });
    }
    setActionLoading(false);
  };

  const handleRenew = async (transactionId: number) => {
    setActionLoading(true);
    const result = await renewBook(transactionId);
    if (result.success) {
      setNotification({ type: 'success', message: result.message || 'Book renewed' });
      fetchMyTransactions();
    } else {
      setNotification({ type: 'error', message: result.error || 'Failed to renew book' });
    }
    setActionLoading(false);
  };

  const handleGenerateQR = () => {
    setQrGenerated(true);
  };

  const handleSaveQR = () => {
    const canvas = document.getElementById('user-qr-code') as HTMLCanvasElement;
    if (canvas) {
      const link = document.createElement('a');
      link.download = `qr-${user?.officialId || user?.studentId || 'user'}.png`;
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  const handleLogout = async () => {
    if (user) {
      await submitLog({
        user_id: user.userId,
        name: user.name,
        user_type: user.userType,
        purpose: 'N/A - Exit',
        log_type: 'exit',
      });
    }
    localStorage.removeItem('userToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('currentUserData');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    navigate('/user/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col">
      <header 
        className="sticky top-0 z-50 shadow-lg border-b-4 border-yellow-500"
        style={{ background: '#111827' }}
      >
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-semibold">Library System</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                >
                  <Bell className="w-5 h-5" />
                  {notifications.reduce((sum, n) => sum + (n.count || 0), 0) > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {notifications.reduce((sum, n) => sum + (n.count || 0), 0)}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
                  <div 
                    className="absolute right-0 mt-2 w-80 rounded-lg shadow-xl border-2 border-yellow-500 py-2 z-50 animate-fade-in max-h-96 overflow-y-auto"
                    style={{ background: '#111827' }}
                    onMouseEnter={() => setNotificationsOpen(true)}
                    onMouseLeave={() => setNotificationsOpen(false)}
                  >
                    <div className="px-4 py-2 border-b border-gray-700">
                      <h3 className="text-white font-semibold">Notifications</h3>
                    </div>
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-gray-400 text-sm">No notifications</div>
                    ) : (
                      notifications.map((notification) => (
                        <div key={notification.id} className="px-4 py-3 hover:bg-gray-700/50 transition-colors">
                          <p className="text-white text-sm">{notification.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => navigate('/user/forgot-password')}
                className="text-xs sm:text-sm text-yellow-400 hover:text-yellow-300 font-medium"
              >
                Change Password
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Profile Section */}
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 border border-gray-700 mb-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">My Info</h2>
              <p className="text-gray-400 text-sm">Personal Information</p>
              <p className="text-gray-500 text-xs mt-1">Welcome, {user.name}</p>
            </div>
          </div>
          <div className="bg-gray-700/50 rounded-lg divide-y divide-gray-600">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-gray-400 text-sm">Student ID</span>
              <span className="text-white font-semibold text-sm">{user.studentId}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-gray-400 text-sm">Full Name</span>
              <span className="text-white font-semibold text-sm">{user.name}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-gray-400 text-sm">Email</span>
              <span className="text-white font-semibold text-sm">{user.email}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-gray-400 text-sm">User Type</span>
              <span className="text-white font-semibold text-sm capitalize">{user.userType}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-gray-400 text-sm">Department</span>
              <span className="text-white font-semibold text-sm">{user.department || '-'}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-gray-400 text-sm">Program / Designation</span>
              <span className="text-white font-semibold text-sm">{user.program || '-'}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-gray-400 text-sm">Year Level / Status</span>
              <span className="text-white font-semibold text-sm">{user.yearLevel || '-'}</span>
            </div>
          </div>
        </div>

        {/* QR Code Section */}
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 border border-gray-700 mb-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center">
              <QrCode className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">My QR Code</h2>
              <p className="text-gray-400 text-sm">Use this QR code to log entry and exit at the library</p>
            </div>
          </div>

          {!qrGenerated ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Purpose of Visit
                </label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                >
                  <option value="" className="bg-gray-700 text-white">Select purpose...</option>
                  {purposes.map((p) => (
                    <option key={p} value={p} className="bg-gray-700 text-white">{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Section
                </label>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                >
                  <option value="Main Library">Main Library</option>
                  <option value="Learning Commons">Learning Commons</option>
                  <option value="Meeting Room">Meeting Room</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Room
                </label>
                <select
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                >
                  <option value="">Select room...</option>
                  {rooms
                    .filter((r: any) => r.section === section)
                    .map((room: any) => (
                      <option key={room.id} value={room.id}>{room.room_name} ({room.room_type})</option>
                    ))}
                </select>
                {rooms.filter((r: any) => r.section === section).length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">No rooms available for this section</p>
                )}
              </div>
              <button
                onClick={handleGenerateQR}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-4 rounded-lg shadow-lg transform transition-all duration-200 hover:scale-105"
              >
                Generate QR Code
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <div className="bg-white p-6 rounded-xl shadow-lg border-4 border-yellow-500">
                <QRCodeSVG
                  id="user-qr-code"
                  value={JSON.stringify({
                    id_type: user.idClassification || user.userType || 'student',
                    official_id: user.officialId || user.studentId
                  })}
                  size={280}
                  level="M"
                />
              </div>
              <div className="text-center space-y-1">
                <p className="text-yellow-400 font-semibold">Present this QR code at the library entrance</p>
                <p className="text-gray-300 text-sm">ID Type: {user.idClassification || user.userType || 'student'}</p>
                <p className="text-gray-300 text-sm">Official ID: {user.officialId || user.studentId}</p>
                <p className="text-gray-300 text-sm">This QR is reusable across visits</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveQR}
                  className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-6 rounded-lg flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Save QR</span>
                </button>
                <button
                  onClick={() => setQrGenerated(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-6 rounded-lg flex items-center space-x-2"
                >
                  <span>Reset</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {purpose === 'Borrowing Books' && (
          <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 border border-gray-700 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center">
                  <BookMarked className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Book Catalog</h2>
                  <p className="text-gray-400 text-sm">Search, filter, and request books</p>
                </div>
              </div>
              <button
                onClick={() => setShowSuggestionModal(true)}
                className="inline-flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Suggest a Book</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by title, author, or ISBN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                />
              </div>
              <div className="relative sm:w-48">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={filterGenre}
                  onChange={(e) => setFilterGenre(e.target.value)}
                  className="w-full pl-10 pr-8 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 appearance-none"
                >
                  <option value="" className="bg-gray-700 text-white">All Genres</option>
                  {Array.from(new Set(books.map((b: any) => b.genre).filter(Boolean))).map((genre: string) => (
                    <option key={genre} value={genre} className="bg-gray-700 text-white">{genre}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-600 text-gray-400">
                    <th className="py-3 px-4 font-medium">Title</th>
                    <th className="py-3 px-4 font-medium">Author</th>
                    <th className="py-3 px-4 font-medium">Genre</th>
                    <th className="py-3 px-4 font-medium">ISBN</th>
                    <th className="py-3 px-4 font-medium text-right">Available</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {books.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">No books available</td>
                    </tr>
                  ) : (
                    books
                      .filter((book: any) => {
                        const q = searchQuery.toLowerCase();
                        return (
                          (book.title || '').toLowerCase().includes(q) ||
                          (book.author || '').toLowerCase().includes(q) ||
                          (book.isbn || '').toLowerCase().includes(q)
                        ) && (!filterGenre || book.genre === filterGenre);
                      })
                      .map((book: any) => (
                        <tr key={book.id} className="hover:bg-gray-700/30 transition-colors">
                          <td className="py-3 px-4 text-white font-medium">{book.title}</td>
                          <td className="py-3 px-4 text-gray-300">{book.author}</td>
                          <td className="py-3 px-4 text-gray-300">
                            {book.genre ? (
                              <span className="inline-flex items-center gap-1 text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                                <Tag className="w-3 h-3" />
                                {book.genre}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-3 px-4 text-gray-400 font-mono text-xs">{book.isbn || '-'}</td>
                          <td className="py-3 px-4 text-right">
                            <span className={`font-semibold ${book.available_copies > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {book.available_copies}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleBorrowRequest(book.id)}
                                disabled={actionLoading || book.available_copies <= 0}
                                className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Borrow
                              </button>
                              <button
                                onClick={() => handleReserveRequest(book.id)}
                                disabled={actionLoading}
                                className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Reserve
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showSuggestionModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 w-full max-w-lg">
              <div className="flex items-center justify-between p-6 border-b border-gray-700">
                <h3 className="text-lg font-bold text-white">Suggest a Book</h3>
                <button onClick={() => setShowSuggestionModal(false)} className="text-gray-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                  <input
                    type="text"
                    value={suggestionForm.title}
                    onChange={(e) => setSuggestionForm({ ...suggestionForm, title: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                    placeholder="Enter book title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Author</label>
                  <input
                    type="text"
                    value={suggestionForm.author}
                    onChange={(e) => setSuggestionForm({ ...suggestionForm, author: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                    placeholder="Enter author name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">ISBN</label>
                  <input
                    type="text"
                    value={suggestionForm.isbn}
                    onChange={(e) => setSuggestionForm({ ...suggestionForm, isbn: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                    placeholder="Enter ISBN if available"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
                  <textarea
                    value={suggestionForm.notes}
                    onChange={(e) => setSuggestionForm({ ...suggestionForm, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                    placeholder="Additional details, tags, or why this book would be useful"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
                <button
                  onClick={() => setShowSuggestionModal(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitSuggestion}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  Submit Suggestion
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Borrowing History Section */}
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 border border-gray-700 mb-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center">
              <History className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">My Borrowings</h2>
              <p className="text-gray-400 text-sm">Track and manage your borrowed books</p>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No borrowing history yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx: any) => (
                <div key={tx.id} className="bg-gray-700/50 rounded-lg p-4 border border-gray-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-white font-semibold">{tx.title}</h4>
                    <p className="text-gray-400 text-sm">Due: {tx.due_date}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold ${tx.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : tx.status === 'active' ? 'bg-blue-500/20 text-blue-400' : tx.status === 'returned' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {tx.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {(tx.status === 'active' || tx.status === 'overdue') && (
                      <>
                        <button onClick={() => handleReturn(tx.id)} className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-2 rounded-lg transition-colors">Return</button>
                        {tx.status === 'active' && (
                          <button onClick={() => handleRenew(tx.id)} className="bg-green-500 hover:bg-green-600 text-white text-sm px-3 py-2 rounded-lg transition-colors">Renew</button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Reservations Section */}
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 border border-gray-700">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center">
              <BookMarked className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">My Reservations</h2>
              <p className="text-gray-400 text-sm">Track your book reservations</p>
            </div>
          </div>

          {reservations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No reservations yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reservations.map((res: any) => (
                <div key={res.id} className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                  <h4 className="text-white font-semibold">{res.title}</h4>
                  <p className="text-gray-400 text-sm">Preferred Date: {res.preferred_date || 'Not set'}</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold ${res.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : res.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {res.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer 
        className="sticky bottom-0 z-50 shadow-lg border-t-4 border-yellow-500 min-h-[60px]"
        style={{ background: '#111827' }}
      >
        <div className="h-full flex items-center justify-start px-4">
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </button>
        </div>
      </footer>
    </div>
  );
}
