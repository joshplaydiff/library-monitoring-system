import React from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
} from 'recharts';
import { Flame, Clock3, Calendar, Timer } from 'lucide-react';
import { useIsMobile } from './ui/use-mobile';
import { AnalyticsTooltip, ANALYTICS_DESCRIPTIONS } from './AnalyticsTooltip';

interface HeatMetricsProps {
  analytics: any;
  peakHours: any[];
  dailyVisits: any[];
  engagementMetrics: any;
  handleDrillDown: (data: any, type: string) => void;
}

// Helper function to format hour
const formatHour = (hour: number) => {
  const date = new Date();
  date.setHours(hour);
  return date.toLocaleString('en-US', {
    hour: '2-digit',
    hour12: true
  });
};

// Helper function to calculate capacity status
const calculateCapacityStatus = (current: number, max: number) => {
  const percentage = (current / max) * 100;
  if (percentage >= 90) return { status: 'critical', color: '#ef4444', label: 'Critical' };
  if (percentage >= 80) return { status: 'warning', color: '#f59e0b', label: 'Warning' };
  return { status: 'normal', color: '#10b981', label: 'Normal' };
};

export function HeatMetrics({ analytics, peakHours, dailyVisits, engagementMetrics, handleDrillDown }: HeatMetricsProps) {
  const isMobile = useIsMobile();
  const currentOccupancy = analytics?.currentlyInside || 0;
  const maxCapacity = analytics?.maxCapacity || 150;
  const occupancyStatus = calculateCapacityStatus(currentOccupancy, maxCapacity);

  // Format peak hours data for chart
  const formattedPeakHours = peakHours.map(item => ({
    hour: formatHour(item.hour),
    count: item.count
  }));

  // Format daily visits data for chart
  const formattedDailyVisits = dailyVisits.map(item => ({
    day: item.day,
    visits: item.visits
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Real-time Occupancy */}
      <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 border-l-4" style={{ borderColor: '#facc15', borderLeftColor: '#facc15' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2">
            <Flame className="w-6 h-6 text-orange-500" />
            <span>Real-time Occupancy</span>
            <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.realTimeOccupancy.description} />
          </h3>
          <span 
            className="px-3 py-1 rounded-full text-sm font-medium text-white"
            style={{ backgroundColor: occupancyStatus.color }}
          >
            {occupancyStatus.label}
          </span>
        </div>
        <div className="flex items-center justify-center py-4">
          <div className="relative w-32 h-32 sm:w-40 sm:h-40">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="64" cy="64" r="52"
                stroke="#e5e7eb"
                strokeWidth="12"
                fill="none"
              />
              <circle
                cx="64" cy="64" r="52"
                stroke={occupancyStatus.color}
                strokeWidth="12"
                fill="none"
                strokeDasharray={`${(currentOccupancy / maxCapacity) * 327} 327`}
                strokeLinecap="round"
                className="transition-none"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl sm:text-4xl font-bold text-gray-800">
                {currentOccupancy}
              </span>
              <span className="text-gray-500 text-sm">/ {maxCapacity}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Average Dwell Time */}
      <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 border-l-4" style={{ borderColor: '#facc15', borderLeftColor: '#facc15' }}>
        <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
          <Timer className="w-6 h-6 text-green-500" />
          <span>Average Dwell Time</span>
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.averageDwellTime.description} />
        </h3>
        <div className="flex items-center justify-center py-4">
          <div className="text-center">
            <div className="text-4xl sm:text-5xl font-bold text-green-600">
              {engagementMetrics?.averageVisitDuration || 0}m
            </div>
            <p className="text-gray-500 text-sm mt-2">Average time in library</p>
          </div>
        </div>
      </div>

      {/* Peak Traffic Hours Chart */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500 min-h-[350px]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2">
            <Clock3 className="w-6 h-6 text-yellow-500" />
            <span>Peak Traffic Hours</span>
            <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.peakTrafficHours.description} />
          </h3>
          <button 
            onClick={() => handleDrillDown(peakHours, 'Peak Hours')}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
          >
            <span>Drill Down</span>
          </button>
        </div>
        <ResponsiveContainer width="100%" height={isMobile ? 180 : 250}>
          <BarChart data={formattedPeakHours} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
            <defs>
              <linearGradient id="colorPeak" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.9}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.3}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="hour" stroke="#6b7280" tick={{ fontSize: 11 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: any) => [`${value} visits`, 'Traffic']} />
            <Bar dataKey="count" fill="url(#colorPeak)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Busiest Days */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500 md:col-span-2 min-h-[350px]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2">
            <Calendar className="w-6 h-6 text-purple-500" />
            <span>Busiest Days of the Week</span>
            <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.busiestDays.description} />
          </h3>
          <button 
            onClick={() => handleDrillDown(dailyVisits, 'Busiest Days')}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
          >
            <span>Drill Down</span>
          </button>
        </div>
        <ResponsiveContainer width="100%" height={isMobile ? 180 : 250}>
          <BarChart data={formattedDailyVisits} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="day" stroke="#6b7280" tick={{ fontSize: 12 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: any) => [`${value} visits`, 'Traffic']} />
            <Bar dataKey="visits" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}