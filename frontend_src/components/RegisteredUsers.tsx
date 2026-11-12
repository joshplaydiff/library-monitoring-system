import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Download, ArrowLeft, RefreshCw, Trash2, Edit, Plus, Upload, FileText } from 'lucide-react';
import { 
  getRegisteredUsers, 
  getRegisteredUsersStats, 
  deleteRegisteredUser,
  importRegisteredUsers,
  getImportBatches,
  RegisteredUser,
  ImportBatch
} from '../utils/api';


export function RegisteredUsers() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<RegisteredUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getRegisteredUsers();
      if (result.success && result.data) {
        setStudents(result.data);
      } else {
        setStudents([]);
      }
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const result = await getRegisteredUsersStats();
      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch {
      setStats(null);
    }
  }, []);

  const loadImportBatches = useCallback(async () => {
    try {
      const result = await getImportBatches();
      if (result.success && result.data) {
        setImportBatches(result.data);
      }
    } catch {
      setImportBatches([]);
    }
  }, []);

  useEffect(() => {
    loadStudents();
    loadStats();
    loadImportBatches();
  }, [loadStudents, loadStats, loadImportBatches]);

  // Filter students based on search term
  const filteredStudents = students.filter(student =>
    student.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.department || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.program_designation || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.year_level_status || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportCSV = () => {
    if (students.length === 0) return;

    // Escape CSV fields to handle special characters
    const escapeCSVField = (field: string) => {
      if (field === null || field === undefined) return '';
      const stringField = String(field);
      // If field contains comma, newline, or double quote, wrap in quotes and escape quotes
      if (stringField.includes(',') || stringField.includes('\n') || stringField.includes('"')) {
        return `"${stringField.replace(/"/g, '""')}"`;
      }
      return stringField;
    };

    const csvContent = [
      'ID,Full Name,Department,Program/Designation,Year Level/Status,Import Date',
      ...students.map(student => 
        `${escapeCSVField(student.student_id)},${escapeCSVField(student.full_name)},${escapeCSVField(student.department || '')},${escapeCSVField(student.program_designation || '')},${escapeCSVField(student.year_level_status || '')},${escapeCSVField(student.import_date || '')}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registered_users_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!importFile) {
      alert('Please select a file to import');
      return;
    }

    setImporting(true);
    try {
      const batchId = `BATCH_${Date.now()}`;
      const result = await importRegisteredUsers(importFile, batchId, 'admin');
      
      if (result.success) {
        alert(result.message || 'Import completed successfully');
        setShowImportDialog(false);
        setImportFile(null);
        loadStudents();
        loadStats();
        loadImportBatches();
      } else {
        alert(result.error || 'Import failed');
      }
    } catch (error) {
      console.error('Error importing users:', error);
      alert('Import failed');
    }
    setImporting(false);
  };

  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      const result = await deleteRegisteredUser(userId);
      if (result.success) {
        loadStudents();
        loadStats();
      } else {
        alert(result.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user');
    }
  };

  const handleClearDatabase = () => {
    if (window.confirm('Are you sure you want to clear the entire student database? This action cannot be undone.')) {
      // This would need to be implemented as a bulk delete API
      alert('This feature needs to be implemented with proper bulk delete API');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <header className="sticky top-0 z-50 shadow-lg border-b-4 border-yellow-500" style={{ background: '#111827' }}>
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 md:py-4">
          <div className="flex items-center justify-between gap-2 md:gap-4">
            <div className="flex items-center gap-3 md:gap-4">
              <button onClick={() => navigate('/admin/dashboard')} className="flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2 md:py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm md:text-base font-medium transition-all">
                <ArrowLeft className="w-4 md:w-5 h-4 md:h-5" />
                <span className="hidden md:inline">Back</span>
              </button>
              <h1 className="text-lg md:text-2xl font-bold text-white">Registered Users</h1>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <button onClick={loadStudents} disabled={loading} className="p-2 md:p-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-all disabled:opacity-50" title="Refresh">
                <RefreshCw className={`w-4 md:w-5 h-4 md:h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={handleExportCSV} disabled={students.length === 0} className="p-2 md:p-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-all disabled:opacity-50" title="Export">
                <Download className="w-4 md:w-5 h-4 md:h-5" />
              </button>
              <button onClick={() => setShowImportDialog(true)} className="p-2 md:p-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-all" title="Import">
                <Upload className="w-4 md:w-5 h-4 md:h-5" />
              </button>
              <button onClick={() => navigate('/admin/students')} className="p-2 md:p-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-all" title="Manage">
                <Edit className="w-4 md:w-5 h-4 md:h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-12 sm:py-14 pb-24">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Registered</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{students.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6 border-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Filtered Results</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{filteredStudents.length}</p>
              </div>
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                <Search className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6 border-4 border-yellow-500 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  id="search-users"
                  name="search-users"
                  placeholder="Search by ID, name, department, program, or year..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <button
              onClick={() => setSearchTerm('')}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              Clear Search
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-sm border-4 border-yellow-500 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Registered List</h2>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600">Loading...</span>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {searchTerm ? 'No students found matching your search.' : 'No students registered yet.'}
              </p>
              <button
                onClick={() => navigate('/admin/students')}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Import Students
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program/Designation</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year Level/Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredStudents.map((student: RegisteredUser, index: number) => (
                    <tr key={student.id || index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {student.student_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {student.department || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {student.program_designation || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {student.year_level_status || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <button
                          onClick={() => student.id && handleDeleteUser(student.id)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {students.length > 0 && (
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleClearDatabase}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Database</span>
            </button>
          </div>
        )}
      </main>

      {/* Import Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 cursor-move">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Import Excel File</h3>
                </div>
                <button
                  onClick={() => {
                    setShowImportDialog(false);
                    setImportFile(null);
                  }}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <div className="mb-6">
                <label htmlFor="file-upload" className="block text-sm font-semibold text-gray-700 mb-3">
                  Select CSV/Excel File
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-500 transition-colors bg-gray-50">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    {importFile ? (
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-3">
                          <FileText className="w-8 h-8 text-green-600" />
                        </div>
                        <p className="text-sm font-medium text-gray-900">{importFile.name}</p>
                        <p className="text-xs text-gray-500 mt-1">Click to change file</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                          <Upload className="w-8 h-8 text-blue-600" />
                        </div>
                        <p className="text-sm font-medium text-gray-700">Click to upload file</p>
                        <p className="text-xs text-gray-500 mt-1">Supports CSV, XLSX, XLS</p>
                      </div>
                    )}
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-3 bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <span className="font-semibold">Required columns:</span> ID, Full Name, Department, Program/Designation, Year Level/Status
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowImportDialog(false);
                    setImportFile(null);
                  }}
                  className="px-5 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={!importFile || importing}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-medium transition-all duration-200 shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:shadow-none flex items-center space-x-2"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Import</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Footer - fixed at bottom of viewport */}
      <footer 
        className="fixed bottom-0 left-0 right-0 z-50 shadow-lg border-t-4 border-yellow-500 min-h-[60px]"
        style={{ background: '#111827' }}
      >
        <div className="px-4 sm:px-6 lg:px-8 py-4">
        </div>
      </footer>
    </div>
  );
}
