import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Download, 
  ArrowLeft, 
  RefreshCw, 
  LogIn, 
  LogOut,
  Activity,
  RotateCcw,
  Wifi,
  WifiOff,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { getLogs, exportAnalyticsToPDF } from '../utils/api';
import { AnalyticsTooltip, ANALYTICS_DESCRIPTIONS } from './AnalyticsTooltip';
import { useRefresh } from '../context/RefreshContext';
import { useRealTimeData } from '../context/RealTimeContext';

interface LogEntry {
  id?: number;
  user_id?: string | number;
  name?: string;
  user_type?: string;
  department?: string;
  purpose: string;
  log_type: 'entry' | 'exit';
  timestamp?: string;
}



export function VisitLogsReports() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [logTypeFilter, setLogTypeFilter] = useState<'all' | 'entry' | 'exit'>('all');
  const [purposeFilter, setPurposeFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [exportingPdf, setExportingPdf] = useState(false);

  const { realTimeData, connectionStatus } = useRealTimeData();

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getLogs({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: 1000
      });
      if (result.success && result.data) {
        setLogs(result.data);
      } else {
        setLogs([]);
      }
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useRefresh('visitLogs', loadLogs);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (realTimeData.lastUpdate) {
      loadLogs();
    }
  }, [realTimeData.lastUpdate, loadLogs]);


  const filteredLogs = logs.filter(log => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = 
      String(log.user_id || '').toLowerCase().includes(search) ||
      (log.name || '').toLowerCase().includes(search) ||
      (log.department || '').toLowerCase().includes(search) ||
      (log.purpose || '').toLowerCase().includes(search);
    
    const matchesLogType = logTypeFilter === 'all' || log.log_type === logTypeFilter;
    
    const matchesPurpose = purposeFilter === 'all' || log.purpose === purposeFilter;
    
    return matchesSearch && matchesLogType && matchesPurpose;
  });



  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

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
      'ID,Name,User Type,Department,Purpose,Log Type,Timestamp',
      ...filteredLogs.map(log => 
        `${escapeCSVField(log.user_id || '')},${escapeCSVField(log.name || '')},${escapeCSVField(log.user_type || '')},${escapeCSVField(log.department || '')},${escapeCSVField(log.purpose || '')},${escapeCSVField(log.log_type || '')},${escapeCSVField(log.timestamp || '')}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visit_logs_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    if (filteredLogs.length === 0 || exportingPdf) return;
    
    setExportingPdf(true);
    try {
      const analytics = {
        totalLogs: filteredLogs.length,
        entryCount: filteredLogs.filter(l => l.log_type === 'entry').length,
        exitCount: filteredLogs.filter(l => l.log_type === 'exit').length,
        logs: filteredLogs
      };

      const result = await exportAnalyticsToPDF(analytics, {
        reportType: 'visit_logs',
        dateRange: startDate && endDate ? `${startDate} to ${endDate}` : 'All dates',
        includeCharts: false,
        includeRecommendations: false
      });

      if (!result.success) {
        alert(result.error || 'Failed to export PDF');
      }
    } catch (error) {
      alert('Failed to export PDF');
      console.error('PDF export error:', error);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleRefresh = () => {
    loadLogs();
  };

  const clearFilters = () => {
    setSearchTerm('');
    setLogTypeFilter('all');
    setPurposeFilter('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, logTypeFilter, purposeFilter, startDate, endDate, itemsPerPage]);

  // Get unique purposes for filter dropdown
  const uniquePurposes = Array.from(new Set(logs.map(log => log.purpose).filter(Boolean)));

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
              <h1 className="text-lg md:text-2xl font-bold text-white flex items-center">
                Visit Logs
                <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.visitLogs.description} />
              </h1>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-800">
                {connectionStatus === 'connected' ? (
                  <>
                    <Wifi className="w-3 h-3 text-green-400" />
                    <span className="text-green-400 text-xs">Live</span>
                  </>
                ) : connectionStatus === 'connecting' ? (
                  <>
                    <RefreshCw className="w-3 h-3 text-yellow-400 animate-spin" />
                    <span className="text-yellow-400 text-xs">Connecting</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 text-red-400" />
                    <span className="text-red-400 text-xs">Offline</span>
                  </>
                )}
              </div>
              <button onClick={handleRefresh} disabled={loading} className="p-2 md:p-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-all disabled:opacity-50" title="Refresh">
                <RefreshCw className={`w-4 md:w-5 h-4 md:h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <div className="flex items-center gap-1">
                <button 
                  onClick={handleExportCSV} 
                  disabled={filteredLogs.length === 0} 
                  className="p-2 md:p-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                  title="Export CSV"
                >
                  <FileSpreadsheet className="w-4 md:w-5 h-4 md:h-5" />
                </button>
                <button 
                  onClick={handleExportPDF} 
                  disabled={filteredLogs.length === 0 || exportingPdf} 
                  className="p-2 md:p-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                  title="Export PDF"
                >
                  {exportingPdf ? (
                    <RefreshCw className="w-4 md:w-5 h-4 md:h-5 animate-spin" />
                  ) : (
                    <FileText className="w-4 md:w-5 h-4 md:h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-12 sm:py-14 pb-24">




        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border-4 border-yellow-500 mb-8">
          <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
            <div className="flex-1 min-w-0 sm:min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  id="search-logs"
                  name="search-logs"
                  placeholder="Search by ID, name, department, or purpose..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="w-full sm:w-auto">
              <label htmlFor="log-type-filter" className="block text-sm font-medium text-gray-700 mb-1">Log Type</label>
              <select
                id="log-type-filter"
                name="log-type-filter"
                value={logTypeFilter}
                onChange={(e) => setLogTypeFilter(e.target.value as 'all' | 'entry' | 'exit')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="entry">Entry</option>
                <option value="exit">Exit</option>
              </select>
            </div>
            <div className="w-full sm:w-auto">
              <label htmlFor="purpose-filter" className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
              <select
                id="purpose-filter"
                name="purpose-filter"
                value={purposeFilter}
                onChange={(e) => setPurposeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Purposes</option>
                {uniquePurposes.map(purpose => (
                  <option key={purpose} value={purpose}>{purpose}</option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-auto">
              <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                id="start-date"
                name="start-date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="w-full sm:w-auto">
              <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                id="end-date"
                name="end-date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
              <button
                onClick={clearFilters}
                className="w-full sm:w-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors self-end"
              >
                Clear Filters
              </button>
              <div className="w-full sm:w-auto">
                <label htmlFor="items-per-page" className="block text-sm font-medium text-gray-700 mb-1">Per Page</label>
                <select
                  id="items-per-page"
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
            </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-xl shadow-sm border-4 border-yellow-500 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Visit Logs</h2>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600">Loading...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {searchTerm || logTypeFilter !== 'all' || purposeFilter !== 'all' || startDate || endDate
                  ? 'No logs found matching your filters.'
                  : 'No visit logs yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="hidden sm:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purpose</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Log Type</th>
                    <th className="hidden md:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedLogs.map((log: LogEntry, index: number) => (
                    <tr key={log.id || index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {log.user_id || '-'}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.name || '-'}
                      </td>
                      <td className="hidden sm:table-cell px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-600">
                        {log.department || '-'}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-600 capitalize">
                        {log.purpose || '-'}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          log.log_type === 'entry' 
                            ? 'bg-green-100 text-green-800 border border-green-200' 
                            : 'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                          {log.log_type === 'entry' ? (
                            <LogIn className="w-3.5 h-3.5 mr-1.5" />
                          ) : (
                            <LogOut className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          {log.log_type === 'entry' ? 'Entry' : 'Exit'}
                        </span>
                      </td>
                      <td className="hidden md:table-cell px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-600">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Filtered Results Count */}
        {filteredLogs.length > 0 && (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-600">
            <div>
              Showing {startIndex + 1} to {Math.min(endIndex, filteredLogs.length)} of {filteredLogs.length} logs
              {searchTerm || logTypeFilter !== 'all' || purposeFilter !== 'all' || startDate || endDate ? (
                <span> (filtered from {logs.length} total)</span>
              ) : null}
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                  className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (safeCurrentPage <= 4) {
                      pageNum = i + 1;
                    } else if (safeCurrentPage >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = safeCurrentPage - 3 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                          safeCurrentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
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
