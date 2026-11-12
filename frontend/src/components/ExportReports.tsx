import React, { useState } from 'react';
import { 
  FileDown, 
  FileSpreadsheet, 
  FileText, 
  Calendar, 
  Clock, 
  TrendingUp, 
  Filter,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle,
  BarChart3,
  Users,
  Building2,
  Target,
  Gauge,
  Zap
} from 'lucide-react';
import { Button } from './ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { Badge } from './ui/badge';
import { exportAnalyticsToExcel, exportAnalyticsToPDF, getAnalyticsForExport } from '../utils/api';

interface ExportReportsProps {
  analytics: any;
  isOnline: boolean;
}

type ExportFormat = 'excel' | 'pdf';
type ReportType = 'overview' | 'detailed' | 'comparative';
type DateRange = 'week' | 'month' | 'quarter' | 'custom';

interface ExportOptions {
  format: ExportFormat;
  reportType: ReportType;
  dateRange: DateRange;
  customStartDate?: string;
  customEndDate?: string;
  includeCharts: boolean;
  includeRecommendations: boolean;
}

export function ExportReports({ analytics, isOnline }: ExportReportsProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'excel',
    reportType: 'overview',
    dateRange: 'week',
    includeCharts: true,
    includeRecommendations: true
  });
  const [customDateRange, setCustomDateRange] = useState({
    startDate: '',
    endDate: ''
  });

  const handleExport = async () => {
    if (!isOnline) {
      setExportStatus('error');
      setErrorMessage('Cannot export while offline. Please connect to the network.');
      return;
    }

    setIsExporting(true);
    setExportStatus('exporting');
    setExportProgress(0);
    setErrorMessage('');

    try {
      setExportProgress(30);

      const analyticsResult = await getAnalyticsForExport(exportOptions.dateRange, customDateRange.startDate, customDateRange.endDate);
      
      if (!analyticsResult.success || !analyticsResult.data) {
        throw new Error(analyticsResult.error || 'Failed to fetch analytics data');
      }

      setExportProgress(60);

      let result;
      if (exportOptions.format === 'excel') {
        result = await exportAnalyticsToExcel(analyticsResult.data, exportOptions);
      } else {
        result = await exportAnalyticsToPDF(analyticsResult.data, exportOptions);
      }

      setExportProgress(100);

      if (result.success) {
        setExportStatus('success');
        setTimeout(() => {
          setExportStatus('idle');
          setExportProgress(0);
        }, 3000);
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (error: any) {
      setExportStatus('error');
      setErrorMessage(error.message || 'An unexpected error occurred during export');
      setExportProgress(0);
    } finally {
      setIsExporting(false);
    }
  };

  const getReportTypeDescription = (type: ReportType) => {
    switch (type) {
      case 'overview':
        return 'Summary of key metrics and trends';
      case 'detailed':
        return 'Comprehensive data with all metrics and breakdowns';
      case 'comparative':
        return 'Compare different time periods side by side';
      default:
        return '';
    }
  };

  const getEstimatedSize = () => {
    const baseSize = exportOptions.reportType === 'detailed' ? '2-3 MB' : '500 KB - 1 MB';
    return baseSize;
  };

  return (
    <div className="space-y-6">
      {/* Main Card - Everything in one card */}
      <div 
        className="rounded-2xl shadow-lg p-6 bg-white border-4 border-yellow-500"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <FileDown className="w-6 h-6 text-blue-600" />
              Export Reports
            </h3>
            <p className="text-gray-600 mt-1">
              Generate and download analytics reports
            </p>
          </div>
          <Badge variant={isOnline ? "default" : "destructive"} className="text-sm px-3 py-1">
            {isOnline ? (
              <><CheckCircle className="w-4 h-4 mr-1" /> Online</>
            ) : (
              <><AlertCircle className="w-4 h-4 mr-1" /> Offline</>
            )}
          </Badge>
        </div>

        {/* Export Configuration */}
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5 text-blue-600" />
            Export Configuration
          </h4>
          
          <div className="space-y-4">
            {/* Format Selection */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Export Format</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setExportOptions({ ...exportOptions, format: 'excel' })}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-2 ${
                    exportOptions.format === 'excel' 
                      ? 'border-green-500 bg-green-50 shadow-md' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <FileSpreadsheet className={`w-8 h-8 ${exportOptions.format === 'excel' ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className={`font-semibold ${exportOptions.format === 'excel' ? 'text-green-700' : 'text-gray-600'}`}>
                    Excel (.xlsx)
                  </span>
                  <span className="text-xs text-gray-500">Best for data analysis</span>
                </button>
                <button
                  onClick={() => setExportOptions({ ...exportOptions, format: 'pdf' })}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-2 ${
                    exportOptions.format === 'pdf' 
                      ? 'border-red-500 bg-red-50 shadow-md' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <FileText className={`w-8 h-8 ${exportOptions.format === 'pdf' ? 'text-red-600' : 'text-gray-400'}`} />
                  <span className={`font-semibold ${exportOptions.format === 'pdf' ? 'text-red-700' : 'text-gray-600'}`}>
                    PDF Report
                  </span>
                  <span className="text-xs text-gray-500">Best for sharing</span>
                </button>
              </div>
            </div>

            {/* Report Type */}
            <div className="space-y-2">
              <label htmlFor="report-type" className="text-sm font-medium text-gray-700">Report Type</label>
              <Select 
                value={exportOptions.reportType} 
                onValueChange={(value: ReportType) => setExportOptions({ ...exportOptions, reportType: value })}
              >
                <SelectTrigger id="report-type" className="w-full">
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overview">
                    <div className="flex flex-col">
                      <span className="font-medium">Overview Report</span>
                      <span className="text-xs text-gray-500">Summary of key metrics</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="detailed">
                    <div className="flex flex-col">
                      <span className="font-medium">Detailed Report</span>
                      <span className="text-xs text-gray-500">Complete analytics breakdown</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="comparative">
                    <div className="flex flex-col">
                      <span className="font-medium">Comparative Report</span>
                      <span className="text-xs text-gray-500">Compare time periods</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">{getReportTypeDescription(exportOptions.reportType)}</p>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <label htmlFor="date-range" className="text-sm font-medium text-gray-700">Date Range</label>
              <Select 
                value={exportOptions.dateRange} 
                onValueChange={(value: DateRange) => setExportOptions({ ...exportOptions, dateRange: value })}
              >
                <SelectTrigger id="date-range" className="w-full">
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Last 7 Days
                    </div>
                  </SelectItem>
                  <SelectItem value="month">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Last 30 Days
                    </div>
                  </SelectItem>
                  <SelectItem value="quarter">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Last 90 Days
                    </div>
                  </SelectItem>
                  <SelectItem value="custom">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4" /> Custom Range
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Range */}
            {exportOptions.dateRange === 'custom' && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="space-y-2">
                  <label htmlFor="export-start-date" className="text-xs font-medium text-gray-600">Start Date</label>
                  <input
                    type="date"
                    id="export-start-date"
                    name="exportStartDate"
                    value={customDateRange.startDate}
                    onChange={(e) => setCustomDateRange({ ...customDateRange, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="export-end-date" className="text-xs font-medium text-gray-600">End Date</label>
                  <input
                    type="date"
                    id="export-end-date"
                    name="exportEndDate"
                    value={customDateRange.endDate}
                    onChange={(e) => setCustomDateRange({ ...customDateRange, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Additional Options */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Include in Report</p>
              <div className="space-y-2">
                <label htmlFor="include-charts" className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    id="include-charts"
                    name="includeCharts"
                    checked={exportOptions.includeCharts}
                    onChange={(e) => setExportOptions({ ...exportOptions, includeCharts: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-gray-700">Include Charts & Visualizations</span>
                  </div>
                </label>
                <label htmlFor="include-recommendations" className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    id="include-recommendations"
                    name="includeRecommendations"
                    checked={exportOptions.includeRecommendations}
                    onChange={(e) => setExportOptions({ ...exportOptions, includeRecommendations: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-gray-700">Include Recommendations</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Export Button */}
            <div className="pt-4 border-t border-gray-200">
              <Button
                onClick={handleExport}
                disabled={isExporting || !isOnline || (exportOptions.dateRange === 'custom' && (!customDateRange.startDate || !customDateRange.endDate))}
                className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Exporting... {exportProgress}%
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-2" />
                    Export {exportOptions.format === 'excel' ? 'Excel' : 'PDF'} Report
                  </>
                )}
              </Button>
              
              {exportStatus === 'success' && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Report exported successfully!</span>
                </div>
              )}
              
              {exportStatus === 'error' && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">{errorMessage}</span>
                </div>
              )}

              <p className="text-xs text-gray-500 text-center mt-2">
                Estimated file size: {getEstimatedSize()}
              </p>
            </div>
          </div>
        </div>

        {/* What's Included */}
        <div className="border-t border-gray-200 pt-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">What's Included in Reports</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-2">
              <Users className="w-4 h-4 text-blue-600 mt-1" />
              <div>
                <p className="text-sm font-medium text-gray-700">Visitor Analytics</p>
                <p className="text-xs text-gray-500">User counts & trends</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Building2 className="w-4 h-4 text-green-600 mt-1" />
              <div>
                <p className="text-sm font-medium text-gray-700">Space Usage</p>
                <p className="text-xs text-gray-500">Capacity utilization</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Target className="w-4 h-4 text-purple-600 mt-1" />
              <div>
                <p className="text-sm font-medium text-gray-700">Purpose Analysis</p>
                <p className="text-xs text-gray-500">Visit purposes breakdown</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Gauge className="w-4 h-4 text-orange-600 mt-1" />
              <div>
                <p className="text-sm font-medium text-gray-700">Peak Hours</p>
                <p className="text-xs text-gray-500">Busy times analysis</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Zap className="w-4 h-4 text-yellow-600 mt-1" />
              <div>
                <p className="text-sm font-medium text-gray-700">Engagement Score</p>
                <p className="text-xs text-gray-500">User engagement metrics</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <BarChart3 className="w-4 h-4 text-red-600 mt-1" />
              <div>
                <p className="text-sm font-medium text-gray-700">Trends</p>
                <p className="text-xs text-gray-500">Historical comparisons</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Export Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          className="rounded-2xl shadow-lg p-6 bg-white border-4 border-yellow-500 cursor-pointer hover:border-blue-300 transition-all"
          onClick={() => {
            setExportOptions({
              ...exportOptions,
              format: 'excel',
              reportType: 'overview',
              dateRange: 'week'
            });
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-800">Weekly Summary</p>
              <p className="text-xs text-gray-500">Last 7 days overview</p>
            </div>
          </div>
        </div>

        <div 
          className="rounded-2xl shadow-lg p-6 bg-white border-4 border-yellow-500 cursor-pointer hover:border-green-300 transition-all"
          onClick={() => {
            setExportOptions({
              ...exportOptions,
              format: 'pdf',
              reportType: 'detailed',
              dateRange: 'month'
            });
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-800">Monthly Report</p>
              <p className="text-xs text-gray-500">Last 30 days detailed</p>
            </div>
          </div>
        </div>

        <div 
          className="rounded-2xl shadow-lg p-6 bg-white border-4 border-yellow-500 cursor-pointer hover:border-purple-300 transition-all"
          onClick={() => {
            setExportOptions({
              ...exportOptions,
              format: 'excel',
              reportType: 'comparative',
              dateRange: 'quarter'
            });
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-gray-800">Comparative Analysis</p>
              <p className="text-xs text-gray-500">Quarter comparison</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExportReports;
