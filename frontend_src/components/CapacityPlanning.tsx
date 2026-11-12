import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Calendar, 
  BarChart3, 
  Users, 
  Clock, 
  Target,
  AlertTriangle,
  Gauge,
  Activity,
  CalendarDays,
  Zap,
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
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { getCapacityAnalytics } from '../utils/api';
import { AnalyticsTooltip, ANALYTICS_DESCRIPTIONS } from './AnalyticsTooltip';

interface CapacityPlanningProps {
  analytics: any;
  loading: boolean;
}

type PeriodType = 'week' | 'month' | 'year';

interface CapacityData {
  period: PeriodType;
  maxCapacity: number;
  currentStatus: {
    currentOccupancy: number;
    utilizationPercent: number;
    status: string;
    message: string;
    color: string;
  };
  historicalUtilization: {
    period: string;
    date: string;
    avgOccupancy: number;
    maxOccupancy: number;
    peakDailyVisits: number;
    utilizationPercent: number;
    status: string;
  }[];
  peakTimes: {
    busiestHour: number | null;
    busiestDay: string | null;
    hourlyDistribution: { hour: number; label: string; visits: number }[];
    dayDistribution: { day: string; fullDay: string; visits: number }[];
  };
  forecast: {
    date: string;
    day: string;
    predictedUtilization: number;
    predictedOccupancy: number;
    confidence: string;
  }[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function CapacityPlanning({ analytics, loading: parentLoading }: CapacityPlanningProps) {
  const [period, setPeriod] = useState<PeriodType>('month');
  const [capacityData, setCapacityData] = useState<CapacityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch capacity data
  useEffect(() => {
    loadCapacityData();
  }, [period]);

  const loadCapacityData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getCapacityAnalytics(period);
      if (result.success && result.data) {
        setCapacityData(result.data);
      } else {
        setError(result.error || 'Failed to load capacity data');
      }
    } catch (err) {
      setError('Error loading capacity analytics');
      console.error('Capacity analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatHour = (hour: number) => {
    const date = new Date();
    date.setHours(hour);
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      hour12: true
    });
  };

  // Current status card
  const renderCurrentStatus = () => {
    if (!capacityData?.currentStatus) return null;
    const status = capacityData.currentStatus;
    
    return (
      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Current Occupancy */}
        <div className="bg-white rounded-lg shadow-md p-4 border-4 border-yellow-500" style={{ borderLeftColor: status.color }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 flex items-center">
                Current Occupancy
                <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.currentStatus.description} className="ml-1" />
              </p>
              <p className="text-2xl font-bold" style={{ color: status.color }}>
                {status.currentOccupancy}
              </p>
              <p className="text-xs text-gray-500">of {capacityData.maxCapacity} max</p>
            </div>
            <Gauge className="w-8 h-8" style={{ color: status.color }} />
          </div>
        </div>

        {/* Utilization Percent */}
        <div className="bg-white rounded-lg shadow-md p-4 border-4 border-yellow-500" style={{ borderLeftColor: status.color }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Utilization</p>
              <p className="text-2xl font-bold" style={{ color: status.color }}>
                {status.utilizationPercent}%
              </p>
              <p className="text-xs text-gray-500">
                {status.utilizationPercent >= 90 ? 'Critical' : status.utilizationPercent >= 80 ? 'Warning' : 'Normal'}
              </p>
            </div>
            <Activity className="w-8 h-8" style={{ color: status.color }} />
          </div>
        </div>

        {/* Status Message */}
        <div className="bg-white rounded-lg shadow-md p-4 border-4 border-yellow-500 md:col-span-2">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8" style={{ color: status.color }} />
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="font-semibold" style={{ color: status.color }}>
                {status.message}
              </p>
            </div>
          </div>
          {/* Progress bar showing capacity */}
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="h-3 rounded-full transition-all"
                style={{ 
                  width: `${Math.min(status.utilizationPercent, 100)}%`,
                  backgroundColor: status.color
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>80%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Historical utilization chart
  const renderHistoricalChart = () => {
    if (!capacityData?.historicalUtilization || loading) return null;

    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          Historical Capacity Utilization
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.historicalUtilization.description} />
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={capacityData.historicalUtilization}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} unit="%" />
            <Tooltip 
              formatter={(value: number) => [`${value}%`, 'Utilization']}
              contentStyle={{ borderRadius: '8px' }}
            />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="utilizationPercent" 
              name="Utilization %"
              stroke="#3b82f6" 
              fill="#3b82f6" 
              fillOpacity={0.3}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-2 flex gap-4 justify-center text-sm">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            Normal (less than 80%)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            Warning (80-90%)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            Critical (greater than 90%)
          </span>
        </div>
      </div>
    );
  };

  // Peak times visualization
  const renderPeakTimes = () => {
    if (!capacityData?.peakTimes || loading) return null;
    const { peakTimes } = capacityData;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hourly Distribution */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-500" />
            Peak Hours
            <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.peakTimes.description} />
            {peakTimes.busiestHour !== null && (
              <span className="text-sm font-normal text-gray-500">
                (Busiest: {formatHour(peakTimes.busiestHour)})
              </span>
            )}
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={peakTimes.hourlyDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="visits" name="Visits" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Day Distribution */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-green-500" />
            Days of Week
            {peakTimes.busiestDay && (
              <span className="text-sm font-normal text-gray-500">
                (Busiest: {peakTimes.busiestDay})
              </span>
            )}
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={peakTimes.dayDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="visits" name="Visits" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // Forecast visualization
  const renderForecast = () => {
    if (!capacityData?.forecast || loading) return null;

    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-orange-500" />
          Capacity Forecast (Next 7 Days)
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.capacityForecast.description} />
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={capacityData.forecast}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 10 }} unit="%" />
            <Tooltip formatter={(value: number) => [`${value}%`, 'Predicted Utilization']} />
            <Bar 
              dataKey="predictedUtilization" 
              name="Predicted"
              radius={[4, 4, 0, 0]}
            >
              {capacityData.forecast.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.confidence === 'high' ? '#10b981' : entry.confidence === 'medium' ? '#f59e0b' : '#ec4899'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex gap-4 justify-center text-sm">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            High Confidence (1-3 days)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            Medium Confidence (4-5 days)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-pink-500"></span>
            Low Confidence (6-7 days)
          </span>
        </div>
      </div>
    );
  };

  // Period selector
  const renderPeriodSelector = () => {
    return (
      <div className="md:col-span-2 flex items-center gap-2 mb-4 p-4 bg-white rounded-2xl shadow-lg border-4 border-yellow-500">
        <span className="text-sm text-gray-600 font-medium">Time Period:</span>
        <div className="flex rounded-lg overflow-hidden border">
          {(['week', 'month', 'year'] as PeriodType[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                period === p 
                  ? 'bg-yellow-500 text-white' 
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>
    );
  };

  if (loading && !capacityData) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-96 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {error && (
        <div className="md:col-span-2 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {renderPeriodSelector()}
      
      {renderCurrentStatus()}
      
      {renderHistoricalChart()}
      
      {renderPeakTimes()}
      
      {renderForecast()}

      {/* Summary Cards */}
      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Max Capacity</p>
              <p className="text-3xl font-bold text-blue-600">{capacityData?.maxCapacity || 150}</p>
            </div>
            <Users className="w-10 h-10 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Warning Threshold</p>
              <p className="text-3xl font-bold text-orange-600">120</p>
              <p className="text-xs text-gray-400">(80%)</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-orange-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Critical Threshold</p>
              <p className="text-3xl font-bold text-red-600">135</p>
              <p className="text-xs text-gray-400">(90%)</p>
            </div>
            <Zap className="w-10 h-10 text-red-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
