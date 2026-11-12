import React from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip 
} from 'recharts';
import { Timer, TrendingUp, Building2 } from 'lucide-react';
import { AnalyticsTooltip, ANALYTICS_DESCRIPTIONS } from './AnalyticsTooltip';

interface DepartmentAnalyticsProps {
  analytics: any;
}

const formatHour = (hour: number) => {
  const date = new Date();
  date.setHours(hour);
  return date.toLocaleString('en-US', {
    hour: '2-digit',
    hour12: true
  });
};

export function DepartmentAnalyticsSection({ analytics }: DepartmentAnalyticsProps) {
  const departmentAnalytics = analytics?.departmentAnalytics;

  if (!departmentAnalytics) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Department Analytics</h3>
        <div className="text-center py-8 text-gray-500">No department analytics data available</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Average Visit Duration by Department */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
        <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
          <Timer className="w-6 h-6 text-indigo-500" />
          <span>Average Visit Duration by Department</span>
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.avgDurationByDepartment.description} />
        </h3>
        {departmentAnalytics.avgDurationByDepartment && 
         Object.keys(departmentAnalytics.avgDurationByDepartment).length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart 
              data={Object.entries(departmentAnalytics.avgDurationByDepartment).map(([dept, data]: [string, any]) => ({
                department: dept, 
                duration: data.avgDuration, 
                sessions: data.sessionCount
              }))} 
              layout="vertical" 
              margin={{ top: 20, right: 30, left: 100, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 12 }} label={{ value: 'Minutes', position: 'insideBottom', offset: -5 }} />
              <YAxis type="category" dataKey="department" stroke="#6b7280" tick={{ fontSize: 11 }} width={90} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
              <Bar dataKey="duration" fill="#6366f1" radius={[0, 6, 6, 0]} name="duration" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-gray-500">No department duration data available</div>
        )}
      </div>

      {/* Department Growth Trends */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
        <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
          <TrendingUp className="w-6 h-6 text-emerald-500" />
          <span>Department Growth Trends (Week-over-Week)</span>
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.departmentGrowthTrends.description} />
        </h3>
        {departmentAnalytics.departmentGrowthTrends && 
         Object.keys(departmentAnalytics.departmentGrowthTrends).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(departmentAnalytics.departmentGrowthTrends).map(([dept, data]: [string, any]) => (
              <div key={dept} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-800 capitalize">{dept}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    data.trend === 'up' ? 'bg-green-100 text-green-700' : 
                    data.trend === 'down' ? 'bg-red-100 text-red-700' : 
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {data.growthPercent > 0 ? '+' : ''}{data.growthPercent}%
                  </span>
                </div>
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Current: {data.currentWeek}</span>
                  <span>Previous: {data.previousWeek}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-2 rounded-full transition-all duration-500 ${
                      data.trend === 'up' ? 'bg-green-500' : 
                      data.trend === 'down' ? 'bg-red-500' : 
                      'bg-gray-500'
                    }`} 
                    style={{ width: `${Math.min(Math.abs(data.growthPercent) + 20, 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">No department growth data available</div>
        )}
      </div>

      {/* Visits by Department with Hourly Breakdown */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
        <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
          <Building2 className="w-6 h-6 text-cyan-500" />
          <span>Visits by Department with Peak Hours</span>
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.visitsByDepartment.description} />
        </h3>
        {departmentAnalytics.visitsByDepartment && 
         Object.keys(departmentAnalytics.visitsByDepartment).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(departmentAnalytics.visitsByDepartment).map(([dept, data]: [string, any]) => {
              const hourlyDist = data.hourlyDistribution || {};
              const peakHour = Object.entries(hourlyDist).reduce((max: [string, number], [hour, count]) => 
                (count as number) > (max[1] || 0) ? [hour, count as number] : max, ['0', 0]);
              
              return (
                <div key={dept} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-gray-800 capitalize">{dept}</span>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-gray-600">
                        <span className="font-medium text-cyan-600">{data.totalVisits}</span> total visits
                      </span>
                      <span className="text-sm bg-cyan-100 text-cyan-700 px-2 py-1 rounded">
                        Peak: {formatHour(parseInt(peakHour[0]))}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {Array.from({ length: 24 }, (_, i) => {
                      const count = hourlyDist[i] || 0;
                      const values = Object.values(hourlyDist).map((v: any) => typeof v === 'number' && !isNaN(v) ? v : 0);
                      const maxCount = values.length > 0 ? Math.max(...values) : 0;
                      const intensity = maxCount > 0 ? (count / maxCount) : 0;
                      
                      return (
                        <div 
                          key={i}
                          className="w-6 h-6 rounded flex items-center justify-center text-xs text-white"
                          style={{ 
                            backgroundColor: count > 0 
                              ? `rgba(6, 182, 212, ${0.2 + intensity * 0.8})` 
                              : '#e5e7eb',
                            color: intensity > 0.5 ? 'white' : '#6b7280'
                          }}
                          title={`${i}:00 - ${count} visits`}
                        >
                          {i}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 text-xs text-gray-500 flex justify-between">
                    <span>12AM</span>
                    <span>6AM</span>
                    <span>12PM</span>
                    <span>6PM</span>
                    <span>11PM</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">No department visit data available</div>
        )}
      </div>
    </div>
  );
}