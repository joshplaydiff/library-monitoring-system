import React from 'react';
import { useIsMobile } from './ui/use-mobile';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
} from 'recharts';
import { Timer, Building2, Target, Repeat, UserCheck } from 'lucide-react';
import { AnalyticsTooltip, ANALYTICS_DESCRIPTIONS } from './AnalyticsTooltip';

interface UserBehaviorAnalyticsProps {
  analytics: any;
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

export function UserBehaviorAnalytics({ analytics }: UserBehaviorAnalyticsProps) {
  const isMobile = useIsMobile();
  const userBehavior = analytics?.userBehavior || {};
  const avgDurationByUserType = userBehavior.avgDurationByUserType || {};
  const peakUsageByDepartment = userBehavior.peakUsageByDepartment || {};
  const topPurposesByUserType = userBehavior.topPurposesByUserType || {};
  const retentionRate = userBehavior.retentionRate?.rate !== undefined ? userBehavior.retentionRate : { rate: 0, retainedUsers: 0, previousUsers: 0 };
  const visitorRatio = userBehavior.visitorRatio?.firstTime?.percentage !== undefined 
    ? userBehavior.visitorRatio 
    : { firstTime: { count: 0, percentage: 0 }, returning: { count: 0, percentage: 0 } };

  // Process data for charts
  const durationByTypeData = Object.entries(avgDurationByUserType).map(([type, data]: [string, any]) => ({
    type: type.charAt(0).toUpperCase() + type.slice(1),
    duration: data.avgDuration,
    sessions: data.sessionCount
  }));

  const departmentPeakData = Object.entries(peakUsageByDepartment).map(([dept, data]: [string, any]) => ({
    department: dept,
    peakHour: formatHour(data.peakHour),
    visits: data.visits
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Average Session Duration by User Type */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
        <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
          <Timer className="w-6 h-6 text-blue-500" />
          <span>Average Session Duration by User Type</span>
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.avgSessionDurationByUserType.description} />
        </h3>
        {durationByTypeData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={durationByTypeData} layout="vertical" margin={{ top: 20, right: 30, left: 40, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 12 }} label={{ value: 'Minutes', position: 'insideBottom', offset: -5 }} />
              <YAxis type="category" dataKey="type" stroke="#6b7280" tick={{ fontSize: 12 }} width={80} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                formatter={(value, name) => [
                  name === 'duration' ? `${value} min` : `${value} sessions`,
                  name === 'duration' ? 'Avg Duration' : 'Sessions'
                ]}
              />
              <Bar dataKey="duration" fill="#3b82f6" radius={[0, 6, 6, 0]} name="duration" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-gray-500">No session duration data available</div>
        )}
      </div>

      {/* Peak Usage Times by Department */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
        <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
          <Building2 className="w-6 h-6 text-green-500" />
          <span>Peak Usage Times by Department</span>
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.peakUsageByDepartment.description} />
        </h3>
        {departmentPeakData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={departmentPeakData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis 
                dataKey="department" 
                stroke="#6b7280" 
                tick={{ fontSize: 10 }} 
                height={80}
              />
              <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} label={{ value: 'Visits', angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                formatter={(value, name) => [
                  name === 'visits' ? `${value} visits` : value,
                  name === 'visits' ? 'Peak Visits' : 'Peak Hour'
                ]}
              />
              <Bar dataKey="visits" fill="#10b981" radius={[6, 6, 0, 0]} name="visits" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-gray-500">No department usage data available</div>
        )}
      </div>

      {/* Most Common Visit Purposes by User Type */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
        <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
          <Target className="w-6 h-6 text-purple-500" />
          <span>Top Visit Purposes by User Type</span>
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.topPurposesByUserType.description} />
        </h3>
        {Object.keys(topPurposesByUserType).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(topPurposesByUserType).map(([userType, purposes]: [string, any]) => (
              <div key={userType} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3 capitalize">{userType}</h4>
                <div className="space-y-2">
                  {Array.isArray(purposes) && purposes.map((purpose: string, index: number) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-gray-700">{purpose}</span>
                      <span className="text-sm text-gray-500">#{index + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">No purpose data available</div>
        )}
      </div>

      {/* User Retention Rate */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
        <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
          <Repeat className="w-6 h-6 text-teal-500" />
          <span>User Retention Rate</span>
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.userRetention.description} />
        </h3>
        <div className="flex items-center justify-center py-6">
          <div className="relative w-48 h-48">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="96" cy="96" r="80"
                stroke="#e5e7eb"
                strokeWidth="16"
                fill="none"
              />
              <circle
                cx="96" cy="96" r="80"
                stroke="#14b8a6"
                strokeWidth="16"
                fill="none"
                strokeDasharray={`${(retentionRate.rate / 100) * 502} 502`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold text-teal-600">
                {retentionRate.rate}%
              </span>
              <span className="text-gray-500 text-sm">Retention</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="text-center p-3 bg-teal-50 rounded-lg">
            <div className="text-2xl font-bold text-teal-700">{retentionRate.retainedUsers}</div>
            <div className="text-sm text-teal-600">Retained Users</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-700">{retentionRate.previousUsers}</div>
            <div className="text-sm text-gray-600">Previous Period</div>
          </div>
        </div>
      </div>

      {/* First-time vs Returning Visitor Ratio */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
        <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
          <UserCheck className="w-6 h-6 text-orange-500" />
          <span>First-time vs Returning Visitors</span>
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.firstTimeVsReturning.description} />
        </h3>
        <div className="space-y-6">
          {/* First-time Visitors */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 font-medium">First-time Visitors</span>
              <span className="text-gray-800 font-bold">{visitorRatio.firstTime.percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
              <div 
                className="bg-orange-500 h-6 rounded-l-full transition-all duration-500"
                style={{ width: `${visitorRatio.firstTime.percentage}%` }}
              ></div>
            </div>
            <div className="text-sm text-gray-500 mt-1">{visitorRatio.firstTime.count} users</div>
          </div>

          {/* Returning Visitors */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 font-medium">Returning Visitors</span>
              <span className="text-gray-800 font-bold">{visitorRatio.returning.percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
              <div 
                className="bg-pink-500 h-6 rounded-l-full transition-all duration-500"
                style={{ width: `${visitorRatio.returning.percentage}%` }}
              ></div>
            </div>
            <div className="text-sm text-gray-500 mt-1">{visitorRatio.returning.count} users</div>
          </div>
        </div>
      </div>
    </div>
  );
}