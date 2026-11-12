import React, { useState, useEffect, useMemo } from 'react';
import { useIsMobile } from './ui/use-mobile';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Calendar, 
  BarChart3, 
  Users, 
  Clock, 
  Target,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  RefreshCw
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  AreaChart, 
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  BarChart,
  Bar
} from 'recharts';
import { getHistoricalAnalytics, getTrendAnalytics } from '../utils/api';
import { AnalyticsTooltip, ANALYTICS_DESCRIPTIONS } from './AnalyticsTooltip';

interface HistoricalTrendAnalysisProps {
  analytics: any;
  loading: boolean;
}

type ComparisonType = 'week-over-week' | 'month-over-month' | 'year-over-year';
type TrendPeriod = 'week' | 'month' | 'year';

interface ComparisonData {
  comparisonType: ComparisonType;
  current: {
    period: string;
    startDate: string;
    endDate: string;
    metrics: {
      totalVisits: number;
      uniqueUsers: number;
      averageDailyVisits: number;
      peakDay: string;
      peakHour: string;
      repeatVisitRate: number;
      averageVisitDuration: number;
    };
  };
  previous: {
    period: string;
    startDate: string;
    endDate: string;
    metrics: {
      totalVisits: number;
      uniqueUsers: number;
      averageDailyVisits: number;
      peakDay: string;
      peakHour: string;
      repeatVisitRate: number;
      averageVisitDuration: number;
    };
  };
  comparison: {
    totalVisits: { change: number; percentage: number; trend: 'up' | 'down' | 'neutral' };
    uniqueUsers: { change: number; percentage: number; trend: 'up' | 'down' | 'neutral' };
    averageDailyVisits: { change: number; percentage: number; trend: 'up' | 'down' | 'neutral' };
    repeatVisitRate: { change: number; percentage: number; trend: 'up' | 'down' | 'neutral' };
    averageVisitDuration: { change: number; percentage: number; trend: 'up' | 'down' | 'neutral' };
  };
}

interface TrendData {
  period: string;
  startDate: string;
  endDate: string;
  metrics: {
    totalVisits: number;
    uniqueUsers: number;
    averageDailyVisits: number;
    repeatVisitRate: number;
  };
}

export function HistoricalTrendAnalysis({ analytics, loading }: HistoricalTrendAnalysisProps) {
  const isMobile = useIsMobile();
  const [comparisonType, setComparisonType] = useState<ComparisonType>('week-over-week');
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('month');
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [comparisonMenuOpen, setComparisonMenuOpen] = useState(false);
  const [trendMenuOpen, setTrendMenuOpen] = useState(false);

  // Fetch comparison data when comparison type changes
  useEffect(() => {
    fetchComparisonData();
  }, [comparisonType]);

  // Fetch trend data when trend period changes
  useEffect(() => {
    fetchTrendData();
  }, [trendPeriod]);

  const fetchComparisonData = async () => {
    setLoadingComparison(true);
    try {
      const result = await getHistoricalAnalytics(comparisonType);
      if (result.success && result.data) {
        setComparisonData(result.data);
      } else {
        console.error('Failed to fetch comparison data:', result.error);
        setComparisonData(null);
      }
    } catch (error) {
      console.error('Error fetching comparison data:', error);
      setComparisonData(null);
    } finally {
      setLoadingComparison(false);
    }
  };

  const fetchTrendData = async () => {
    setLoadingTrends(true);
    try {
      const result = await getTrendAnalytics(trendPeriod, 12);
      if (result.success && result.data) {
        setTrendData(result.data.trends || []);
      } else {
        console.error('Failed to fetch trend data:', result.error);
        setTrendData([]);
      }
    } catch (error) {
      console.error('Error fetching trend data:', error);
      setTrendData([]);
    } finally {
      setLoadingTrends(false);
    }
  };

  // Get trend icon and color
  const getTrendIndicator = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return { icon: TrendingUp, color: 'text-green-500', bgColor: 'bg-green-50' };
      case 'down':
        return { icon: TrendingDown, color: 'text-red-500', bgColor: 'bg-red-50' };
      default:
        return { icon: Minus, color: 'text-gray-500', bgColor: 'bg-gray-50' };
    }
  };

  // Format comparison type label
  const getComparisonLabel = (type: ComparisonType) => {
    switch (type) {
      case 'week-over-week':
        return 'Week-over-Week';
      case 'month-over-month':
        return 'Month-over-Month';
      case 'year-over-year':
        return 'Year-over-Year';
      default:
        return type;
    }
  };

  // Format trend period label
  const getTrendPeriodLabel = (period: TrendPeriod) => {
    switch (period) {
      case 'week':
        return 'Weekly Trends';
      case 'month':
        return 'Monthly Trends';
      case 'year':
        return 'Yearly Trends';
      default:
        return period;
    }
  };

  // Prepare chart data for trends
  const chartData = useMemo(() => {
    return trendData.map(trend => ({
      name: trend.period,
      visits: trend.metrics?.totalVisits || 0,
      users: trend.metrics?.uniqueUsers || 0,
      avgDaily: trend.metrics?.averageDailyVisits || 0,
      repeatRate: trend.metrics?.repeatVisitRate || 0
    }));
  }, [trendData]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
          <span className="ml-3 text-gray-600">Loading historical data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Comparison Section */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2">
              <BarChart3 className="w-6 h-6 text-yellow-500" />
              <span>Historical Comparison</span>
              <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.historicalComparison.description} />
            </h3>
            <p className="text-sm text-gray-500 mt-1">Compare current period with previous period</p>
          </div>
          
          {/* Comparison Type Selector */}
          <div className="relative">
            <button
              onClick={() => setComparisonMenuOpen(!comparisonMenuOpen)}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white transition-all duration-200 shadow-lg text-sm"
            >
              <span className="font-medium">{getComparisonLabel(comparisonType)}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {comparisonMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border-2 border-gray-300 py-2 z-50">
                {(['week-over-week', 'month-over-month', 'year-over-year'] as ComparisonType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setComparisonType(type);
                      setComparisonMenuOpen(false);
                    }}
                    className={`flex items-center w-full px-4 py-2 text-left text-sm transition-colors ${
                      comparisonType === type
                        ? 'bg-yellow-50 text-yellow-700'
                        : 'text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {getComparisonLabel(type)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {loadingComparison ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
            <span className="ml-3 text-gray-600">Loading comparison...</span>
          </div>
        ) : comparisonData && comparisonData.current ? (
          <>
            {/* Period Labels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <p className="text-sm font-medium text-blue-600 mb-1">Current Period</p>
                <p className="text-lg font-bold text-blue-800">{comparisonData.current.period}</p>
                <p className="text-xs text-blue-500 mt-1">
                  {comparisonData.current.startDate} to {comparisonData.current.endDate}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-sm font-medium text-gray-600 mb-1">Previous Period</p>
                <p className="text-lg font-bold text-gray-800">{comparisonData.previous.period}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {comparisonData.previous.startDate} to {comparisonData.previous.endDate}
                </p>
              </div>
            </div>

            {/* Comparison Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Total Visits */}
              <div className={`rounded-xl p-4 border ${getTrendIndicator(comparisonData.comparison.totalVisits.trend).bgColor}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    <span className="text-sm font-medium text-gray-700">Total Visits</span>
                  </div>
                  {(() => {
                    const indicator = getTrendIndicator(comparisonData.comparison.totalVisits.trend);
                    const Icon = indicator.icon;
                    return <Icon className={`w-5 h-5 ${indicator.color}`} />;
                  })()}
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gray-800">
                      {comparisonData.current.metrics.totalVisits.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      vs {comparisonData.previous.metrics.totalVisits.toLocaleString()}
                    </p>
                  </div>
                  <div className={`text-right ${
                    comparisonData.comparison.totalVisits.trend === 'up' ? 'text-green-600' :
                    comparisonData.comparison.totalVisits.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    <p className="text-lg font-bold">
                      {comparisonData.comparison.totalVisits.percentage > 0 ? '+' : ''}
                      {comparisonData.comparison.totalVisits.percentage}%
                    </p>
                    <p className="text-xs">
                      {comparisonData.comparison.totalVisits.change > 0 ? '+' : ''}
                      {comparisonData.comparison.totalVisits.change}
                    </p>
                  </div>
                </div>
              </div>

              {/* Unique Users */}
              <div className={`rounded-xl p-4 border ${getTrendIndicator(comparisonData.comparison.uniqueUsers.trend).bgColor}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Target className="w-5 h-5 text-purple-500" />
                    <span className="text-sm font-medium text-gray-700">Unique Users</span>
                  </div>
                  {(() => {
                    const indicator = getTrendIndicator(comparisonData.comparison.uniqueUsers.trend);
                    const Icon = indicator.icon;
                    return <Icon className={`w-5 h-5 ${indicator.color}`} />;
                  })()}
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gray-800">
                      {comparisonData.current.metrics.uniqueUsers.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      vs {comparisonData.previous.metrics.uniqueUsers.toLocaleString()}
                    </p>
                  </div>
                  <div className={`text-right ${
                    comparisonData.comparison.uniqueUsers.trend === 'up' ? 'text-green-600' :
                    comparisonData.comparison.uniqueUsers.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    <p className="text-lg font-bold">
                      {comparisonData.comparison.uniqueUsers.percentage > 0 ? '+' : ''}
                      {comparisonData.comparison.uniqueUsers.percentage}%
                    </p>
                    <p className="text-xs">
                      {comparisonData.comparison.uniqueUsers.change > 0 ? '+' : ''}
                      {comparisonData.comparison.uniqueUsers.change}
                    </p>
                  </div>
                </div>
              </div>

              {/* Average Daily Visits */}
              <div className={`rounded-xl p-4 border ${getTrendIndicator(comparisonData.comparison.averageDailyVisits.trend).bgColor}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-medium text-gray-700">Avg Daily Visits</span>
                  </div>
                  {(() => {
                    const indicator = getTrendIndicator(comparisonData.comparison.averageDailyVisits.trend);
                    const Icon = indicator.icon;
                    return <Icon className={`w-5 h-5 ${indicator.color}`} />;
                  })()}
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gray-800">
                      {comparisonData.current.metrics.averageDailyVisits.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      vs {comparisonData.previous.metrics.averageDailyVisits.toLocaleString()}
                    </p>
                  </div>
                  <div className={`text-right ${
                    comparisonData.comparison.averageDailyVisits.trend === 'up' ? 'text-green-600' :
                    comparisonData.comparison.averageDailyVisits.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    <p className="text-lg font-bold">
                      {comparisonData.comparison.averageDailyVisits.percentage > 0 ? '+' : ''}
                      {comparisonData.comparison.averageDailyVisits.percentage}%
                    </p>
                    <p className="text-xs">
                      {comparisonData.comparison.averageDailyVisits.change > 0 ? '+' : ''}
                      {comparisonData.comparison.averageDailyVisits.change}
                    </p>
                  </div>
                </div>
              </div>

              {/* Repeat Visit Rate */}
              <div className={`rounded-xl p-4 border ${getTrendIndicator(comparisonData.comparison.repeatVisitRate.trend).bgColor}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="w-5 h-5 text-orange-500" />
                    <span className="text-sm font-medium text-gray-700">Repeat Visit Rate</span>
                  </div>
                  {(() => {
                    const indicator = getTrendIndicator(comparisonData.comparison.repeatVisitRate.trend);
                    const Icon = indicator.icon;
                    return <Icon className={`w-5 h-5 ${indicator.color}`} />;
                  })()}
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gray-800">
                      {comparisonData.current.metrics.repeatVisitRate}%
                    </p>
                    <p className="text-xs text-gray-500">
                      vs {comparisonData.previous.metrics.repeatVisitRate}%
                    </p>
                  </div>
                  <div className={`text-right ${
                    comparisonData.comparison.repeatVisitRate.trend === 'up' ? 'text-green-600' :
                    comparisonData.comparison.repeatVisitRate.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    <p className="text-lg font-bold">
                      {comparisonData.comparison.repeatVisitRate.percentage > 0 ? '+' : ''}
                      {comparisonData.comparison.repeatVisitRate.percentage}%
                    </p>
                    <p className="text-xs">
                      {comparisonData.comparison.repeatVisitRate.change > 0 ? '+' : ''}
                      {comparisonData.comparison.repeatVisitRate.change}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Average Visit Duration */}
              <div className={`rounded-xl p-4 border ${getTrendIndicator(comparisonData.comparison.averageVisitDuration.trend).bgColor}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-indigo-500" />
                    <span className="text-sm font-medium text-gray-700">Avg Visit Duration</span>
                  </div>
                  {(() => {
                    const indicator = getTrendIndicator(comparisonData.comparison.averageVisitDuration.trend);
                    const Icon = indicator.icon;
                    return <Icon className={`w-5 h-5 ${indicator.color}`} />;
                  })()}
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gray-800">
                      {comparisonData.current.metrics.averageVisitDuration}m
                    </p>
                    <p className="text-xs text-gray-500">
                      vs {comparisonData.previous.metrics.averageVisitDuration}m
                    </p>
                  </div>
                  <div className={`text-right ${
                    comparisonData.comparison.averageVisitDuration.trend === 'up' ? 'text-green-600' :
                    comparisonData.comparison.averageVisitDuration.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    <p className="text-lg font-bold">
                      {comparisonData.comparison.averageVisitDuration.percentage > 0 ? '+' : ''}
                      {comparisonData.comparison.averageVisitDuration.percentage}%
                    </p>
                    <p className="text-xs">
                      {comparisonData.comparison.averageVisitDuration.change > 0 ? '+' : ''}
                      {comparisonData.comparison.averageVisitDuration.change}m
                    </p>
                  </div>
                </div>
              </div>

              {/* Peak Day */}
              <div className="rounded-xl p-4 border bg-yellow-50 border-yellow-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-yellow-500" />
                    <span className="text-sm font-medium text-gray-700">Peak Day</span>
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">
                    {comparisonData.current.metrics.peakDay}
                  </p>
                  <p className="text-xs text-gray-500">
                    Previous: {comparisonData.previous.metrics.peakDay}
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>No comparison data available</p>
          </div>
        )}
      </div>

      {/* Trends Section */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2">
              <TrendingUp className="w-6 h-6 text-green-500" />
              <span>Long-Term Trends</span>
              <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.longTermTrends.description} />
            </h3>
            <p className="text-sm text-gray-500 mt-1">View trends over the last 12 periods</p>
          </div>
          
          {/* Trend Period Selector */}
          <div className="relative">
            <button
              onClick={() => setTrendMenuOpen(!trendMenuOpen)}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-all duration-200 shadow-lg text-sm"
            >
              <span className="font-medium">{getTrendPeriodLabel(trendPeriod)}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {trendMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border-2 border-gray-300 py-2 z-50">
                {(['week', 'month', 'year'] as TrendPeriod[]).map((period) => (
                  <button
                    key={period}
                    onClick={() => {
                      setTrendPeriod(period);
                      setTrendMenuOpen(false);
                    }}
                    className={`flex items-center w-full px-4 py-2 text-left text-sm transition-colors ${
                      trendPeriod === period
                        ? 'bg-green-50 text-green-700'
                        : 'text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {getTrendPeriodLabel(period)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {loadingTrends ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            <span className="ml-3 text-gray-600">Loading trends...</span>
          </div>
        ) : chartData.length > 0 ? (
          <>
            {/* Trend Chart */}
            <div className="mb-6">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
                  <defs>
                    <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#6b7280"
                    tick={{ fontSize: 11 }}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    tick={{ fontSize: 12 }}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value: any, name: string) => {
                      if (name === 'visits') return [`${value} visits`, 'Total Visits'];
                      if (name === 'users') return [`${value} users`, 'Unique Users'];
                      return [value, name];
                    }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="visits" 
                    stroke="#3b82f6" 
                    fillOpacity={1} 
                    fill="url(#colorVisits)"
                    strokeWidth={2}
                    name="Total Visits"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="users" 
                    stroke="#10b981" 
                    fillOpacity={1} 
                    fill="url(#colorUsers)"
                    strokeWidth={2}
                    name="Unique Users"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Trend Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                <div className="text-xl font-bold text-blue-700">
                  {chartData.reduce((sum, item) => sum + item.visits, 0).toLocaleString()}
                </div>
                <div className="text-blue-600 font-medium text-xs mt-1">Total Visits (12 periods)</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                <div className="text-xl font-bold text-green-700">
                  {chartData.reduce((sum, item) => sum + (isNaN(item.users) ? 0 : item.users), 0).toLocaleString()}
                </div>
                <div className="text-green-600 font-medium text-xs mt-1">Total Unique Users (12 periods)</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                <div className="text-xl font-bold text-purple-700">
                  {chartData.length > 0 ? (isNaN(Math.round(chartData.reduce((sum, item) => sum + (isNaN(item.avgDaily) ? 0 : item.avgDaily), 0) / chartData.length)) ? 0 : Math.round(chartData.reduce((sum, item) => sum + (isNaN(item.avgDaily) ? 0 : item.avgDaily), 0) / chartData.length)) : 0}
                </div>
                <div className="text-purple-600 font-medium text-xs mt-1">Avg Daily Visits (12 periods)</div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>No trend data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
