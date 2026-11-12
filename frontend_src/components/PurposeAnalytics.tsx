import React from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis, 
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Target, TrendingUp, Users, MapPin, Award } from 'lucide-react';
import { AnalyticsTooltip, ANALYTICS_DESCRIPTIONS } from './AnalyticsTooltip';

interface PurposeAnalyticsData {
  purposeAnalytics?: {
    mostPopularPurposes?: Array<{
      name: string;
      value: number;
    }>;
    purposeByUserType?: Record<string, string[]>;
    purposeTrendsOverTime?: Array<{
      date: string;
      purpose: string;
      count: number;
    }>;
    purposeByDepartment?: Array<{
      department: string;
      purpose: string;
      count: number;
    }>;
  };
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const PurposeAnalytics: React.FC<PurposeAnalyticsData> = ({ purposeAnalytics }) => {
  if (!purposeAnalytics) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Purpose Analytics</h3>
        <div className="text-center py-8 text-gray-500">No purpose analytics data available</div>
      </div>
    );
  }

  const { mostPopularPurposes, purposeByUserType, purposeTrendsOverTime, purposeByDepartment } = purposeAnalytics;

  // Format most popular purposes for ranking display
  const totalPurposeVisits = mostPopularPurposes?.reduce((sum, item) => sum + (typeof item.value === 'number' && !isNaN(item.value) ? item.value : 0), 0) || 0;
  const popularPurposesData = mostPopularPurposes?.slice(0, 10).map((p, index) => ({
    rank: index + 1,
    purpose: p.name,
    visits: typeof p.value === 'number' && !isNaN(p.value) ? p.value : 0,
    percentage: totalPurposeVisits > 0 
      ? ((p.value / totalPurposeVisits) * 100).toFixed(1)
      : '0'
  })) || [];

  // Format purpose trends over time
  const trendsDataMap: Record<string, Record<string, number>> = {};
  const allDates = new Set<string>();
  const allPurposes = new Set<string>();
  
  purposeTrendsOverTime?.forEach(item => {
    const dateKey = new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    allDates.add(dateKey);
    allPurposes.add(item.purpose);
    if (!trendsDataMap[dateKey]) {
      trendsDataMap[dateKey] = {};
    }
    trendsDataMap[dateKey][item.purpose] = item.count;
  });

  // Get top 5 purposes for trends chart
  const top5Purposes = Array.from(allPurposes).slice(0, 5);
  const trendsChartData = Array.from(allDates).map(date => {
    const dataPoint: Record<string, string | number> = { date };
    top5Purposes.forEach(purpose => {
      dataPoint[purpose] = trendsDataMap[date]?.[purpose] || 0;
    });
    return dataPoint;
  });

  // Format purpose by department correlation
  const departmentPurposeMap: Record<string, Array<{ purpose: string; count: number }>> = {};
  purposeByDepartment?.forEach(item => {
    if (!departmentPurposeMap[item.department]) {
      departmentPurposeMap[item.department] = [];
    }
    departmentPurposeMap[item.department].push({ purpose: item.purpose, count: item.count });
  });

  // Get top purposes per department
  const departmentPurposes = Object.entries(departmentPurposeMap).map(([dept, purposes]) => ({
    department: dept,
    topPurposes: purposes.slice(0, 3),
    totalVisits: purposes.reduce((sum, p) => sum + p.count, 0)
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Most Popular Purposes Ranking */}
      <div className="bg-white rounded-2xl border-4 p-6 shadow-lg border-yellow-500">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center space-x-2">
          <Award className="w-5 h-5 text-yellow-500" />
          <span>Most Popular Purposes Ranking</span>
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.popularPurposes.description} />
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Top reasons users visit the library - helps understand user needs
        </p>
        
        {popularPurposesData.length > 0 ? (
          <div className="space-y-3">
            {popularPurposesData.map((item) => (
              <div key={item.rank} className="flex items-center space-x-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                  item.rank === 1 ? 'bg-yellow-500' :
                  item.rank === 2 ? 'bg-gray-400' :
                  item.rank === 3 ? 'bg-amber-600' :
                  'bg-gray-300 text-gray-700'
                }`}>
                  {item.rank}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-gray-800 capitalize">{item.purpose}</span>
                    <span className="text-sm text-gray-600">
                      {item.visits} visits ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${item.percentage}%`,
                        backgroundColor: item.rank <= 3 ? COLORS[item.rank - 1] : '#9ca3af'
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">No purpose data available</div>
        )}
      </div>

      {/* Purpose Trends Over Time */}
      <div className="bg-white rounded-2xl border-4 p-6 shadow-lg border-yellow-500">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          <span>Purpose Trends Over Time</span>
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.purposeTrends.description} />
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Track how different purposes change over time
        </p>
        
        {trendsChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendsChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Legend />
              {top5Purposes.map((purpose, index) => (
                <Line 
                  key={purpose}
                  type="monotone" 
                  dataKey={purpose} 
                  stroke={COLORS[index % COLORS.length]} 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name={purpose}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-gray-500">No trend data available</div>
        )}
      </div>

      {/* Purpose by User Type Correlation */}
      <div className="bg-white rounded-2xl border-4 p-6 shadow-lg border-yellow-500">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center space-x-2">
          <Users className="w-5 h-5 text-green-500" />
          <span>Purpose by User Type Correlation</span>
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.purposeByUserType.description} />
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Understand what each user type comes for
        </p>
        
        {purposeByUserType && Object.keys(purposeByUserType).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(purposeByUserType).map(([userType, purposes]) => (
              <div key={userType} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-800 capitalize">{userType}</span>
                  <span className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    {Array.isArray(purposes) ? purposes.length : 0} purposes
                  </span>
                </div>
                <div className="space-y-2">
                  {Array.isArray(purposes) && purposes.map((purpose, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-gray-700 capitalize">{purpose}</span>
                      <span className="text-sm text-gray-500">#{index + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">No user type purpose correlation data available</div>
        )}
      </div>

      {/* Purpose by Department Correlation */}
      <div className="bg-white rounded-2xl border-4 p-6 shadow-lg border-yellow-500">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center space-x-2">
          <MapPin className="w-5 h-5 text-purple-500" />
          <span>Purpose by Department Correlation</span>
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.purposeByDepartment.description} />
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          See what purposes are most common in each department
        </p>
        
        {departmentPurposes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departmentPurposes.slice(0, 6).map((deptData) => (
              <div key={deptData.department} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-800 capitalize">{deptData.department}</span>
                  <span className="text-sm text-purple-100 text-purple-700 bg-purple-50 px-2 py-1 rounded">
                    {deptData.totalVisits} visits
                  </span>
                </div>
                <div className="space-y-2">
                  {deptData.topPurposes.map((purpose, index) => (
                    <div key={purpose.purpose} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 capitalize truncate flex-1">{purpose.purpose}</span>
                      <span className="text-gray-500 ml-2">{purpose.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">No department purpose correlation data available</div>
        )}

        {/* Insights */}
        {popularPurposesData.length > 0 && (
          <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h4 className="font-semibold text-purple-800 text-sm mb-2">💡 Purpose Insights</h4>
            <ul className="text-sm text-purple-700 space-y-1">
              {popularPurposesData[0] && (
                <li>• Top purpose: <strong>{popularPurposesData[0].purpose}</strong> ({popularPurposesData[0].visits} visits)</li>
              )}
              {purposeByUserType && Object.keys(purposeByUserType).length > 0 && (
                <li>• Active user types with purpose data: {Object.keys(purposeByUserType).length}</li>
              )}
              {departmentPurposes.length > 0 && (
                <li>• Departments with purpose tracking: {departmentPurposes.length}</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default PurposeAnalytics;