import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { AnalyticsTooltip, ANALYTICS_DESCRIPTIONS } from './AnalyticsTooltip';

interface TimeBasedAnalyticsProps {
  timeBasedAnalytics: {
    avgDurationByTimeOfDay: Array<{
      time_period: string;
      avg_duration_minutes: number;
      visit_count: number;
    }>;
    avgDurationByDayOfWeek: Array<{
      day_of_week: string;
      avg_duration_minutes: number;
      visit_count: number;
    }>;
    durationTrendsOverTime: Array<{
      date: string;
      avg_duration_minutes: number;
      visit_count: number;
      min_duration: number;
      max_duration: number;
    }>;
    shortVsLongVisits: {
      short_visits: number;
      medium_visits: number;
      long_visits: number;
      total_visits: number;
    };
  };
}

const TimeBasedAnalytics: React.FC<TimeBasedAnalyticsProps> = ({ timeBasedAnalytics }) => {
  const { avgDurationByTimeOfDay, avgDurationByDayOfWeek, durationTrendsOverTime, shortVsLongVisits } = timeBasedAnalytics;

  // Format data for time of day chart
  const timeOfDayData = avgDurationByTimeOfDay.map(item => ({
    name: item.time_period.replace(/\s*\([^)]+\)/g, ''),
    duration: Math.round(item.avg_duration_minutes || 0),
    visits: item.visit_count
  }));

  // Format data for day of week chart
  const dayOfWeekData = avgDurationByDayOfWeek.map(item => ({
    name: item.day_of_week.substring(0, 3),
    duration: Math.round(item.avg_duration_minutes || 0),
    visits: item.visit_count
  }));

  // Format data for duration trends chart
  const trendsData = durationTrendsOverTime.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    duration: Math.round(item.avg_duration_minutes || 0),
    minDuration: Math.round(item.min_duration || 0),
    maxDuration: Math.round(item.max_duration || 0),
    visits: item.visit_count
  }));

  // Short vs long visits data
  const visitDistribution = [
    { name: 'Short (<30 min)', value: shortVsLongVisits?.short_visits || 0, color: '#22c55e' },
    { name: 'Medium (30-60 min)', value: shortVsLongVisits?.medium_visits || 0, color: '#3b82f6' },
    { name: 'Long (>60 min)', value: shortVsLongVisits?.long_visits || 0, color: '#f59e0b' }
  ];

  const totalVisits = shortVsLongVisits?.total_visits || 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Average Duration by Time of Day */}
      <div className="bg-white rounded-2xl border-4 p-6 shadow-lg border-yellow-500">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          📅 Average Visit Duration by Time of Day
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.avgDurationByTimeOfDay.description} />
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Helps optimize staffing based on when users stay longest
        </p>
        {timeOfDayData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={timeOfDayData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                formatter={(value: number) => [`${value} min`, 'Avg Duration']}
              />
              <Bar dataKey="duration" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Avg Duration" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-gray-500">No time-of-day data available</div>
        )}
      </div>

      {/* Average Duration by Day of Week */}
      <div className="bg-white rounded-2xl border-4 p-6 shadow-lg border-yellow-500">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          📊 Average Visit Duration by Day of Week
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.avgDurationByDayOfWeek.description} />
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Identify which days have longest stays for better resource planning
        </p>
        {dayOfWeekData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dayOfWeekData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                formatter={(value: number) => [`${value} min`, 'Avg Duration']}
              />
              <Bar dataKey="duration" fill="#6366f1" radius={[4, 4, 0, 0]} name="Avg Duration" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-gray-500">No day-of-week data available</div>
        )}
      </div>

      {/* Duration Trends Over Time */}
      <div className="bg-white rounded-2xl border-4 p-6 shadow-lg border-yellow-500">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          📈 Visit Duration Trends Over Time
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.durationTrends.description} />
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Track how average visit duration changes day by day
        </p>
        {trendsData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendsData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                formatter={(value: number, name: string) => {
                  if (name === 'duration') return [`${value} min`, 'Avg Duration'];
                  if (name === 'minDuration') return [`${value} min`, 'Min Duration'];
                  if (name === 'maxDuration') return [`${value} min`, 'Max Duration'];
                  return [value, name];
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="duration" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="Avg Duration" />
              <Line type="monotone" dataKey="minDuration" stroke="#22c55e" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Min Duration" />
              <Line type="monotone" dataKey="maxDuration" stroke="#f59e0b" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Max Duration" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-gray-500">No trend data available</div>
        )}
      </div>

      {/* Short vs Long Visits Distribution */}
      <div className="bg-white rounded-2xl border-4 p-6 shadow-lg border-yellow-500">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          ⏱️ Short vs Long Visits Analysis
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.shortVsLongVisits.description} />
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Distribution of visits by length - useful for understanding user behavior patterns
        </p>
        <div className="space-y-4">
          {visitDistribution.map((item, index) => {
            const percentage = totalVisits > 0 ? (item.value / totalVisits) * 100 : 0;
            return (
              <div key={index} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">{item.name}</span>
                  <span className="text-gray-600">{item.value} visits ({percentage.toFixed(1)}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="h-3 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%`, backgroundColor: item.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Staffing Recommendation */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-blue-800 text-sm mb-2">💡 Staffing Recommendation</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            {shortVsLongVisits?.long_visits > shortVsLongVisits?.short_visits && (
              <li>• Long visits dominate - consider extended service hours</li>
            )}
            {shortVsLongVisits?.short_visits > shortVsLongVisits?.long_visits && (
              <li>• Short visits are common - focus on quick-turn services</li>
            )}
            {avgDurationByTimeOfDay[0] && (
              <li>• Peak stay duration: {avgDurationByTimeOfDay[0].time_period} ({avgDurationByTimeOfDay[0].avg_duration_minutes ? (isNaN(Math.round(avgDurationByTimeOfDay[0].avg_duration_minutes)) ? 0 : Math.round(avgDurationByTimeOfDay[0].avg_duration_minutes)) : 0} min avg)</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TimeBasedAnalytics;