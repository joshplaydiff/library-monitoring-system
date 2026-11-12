import { useIsMobile } from './ui/use-mobile';
import { 
  ResponsiveContainer, 
  PieChart as RePieChart, 
  Pie, 
  Cell, 
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Building2, Repeat, GraduationCap, Clock, Users, TrendingUp, UserCheck, UserX } from 'lucide-react';
import { AnalyticsTooltip, ANALYTICS_DESCRIPTIONS } from './AnalyticsTooltip';

interface StudentInsightsProps {
  analytics: any;
  engagementMetrics: any;
  departmentData: any[];
  programData?: any[];
  yearLevelData?: any[];
  visitFrequencyData?: any[];
  avgDurationByDept?: any[];
  peakTimesByType?: any[];
  newVsReturningData?: any[];
}

const DEPARTMENT_COLORS: { [key: string]: string } = {
  'CEAFA': '#ef4444',
  'CHS': '#10b981',
  'CASE': '#3b82f6',
  'CBMA': '#facc15',
};

const DEFAULT_COLORS = ['#ef4444', '#10b981', '#3b82f6', '#facc15', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const YEAR_LEVEL_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

const PROGRAM_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

export function StudentInsights({ 
  analytics, 
  engagementMetrics, 
  departmentData,
  programData = [],
  yearLevelData = [],
  visitFrequencyData = [],
  avgDurationByDept = [],
  peakTimesByType = [],
  newVsReturningData = []
}: StudentInsightsProps) {
  const isMobile = useIsMobile();
  const repeatVisitRate = engagementMetrics?.repeatVisitRate || 0;
  const uniqueVisitRate = 100 - repeatVisitRate;

  const safeDepartmentData = Array.isArray(departmentData) ? departmentData : [];
  const safeProgramData = Array.isArray(programData) ? programData : [];
  const safeYearLevelData = Array.isArray(yearLevelData) ? yearLevelData : [];
  const safeVisitFrequencyData = Array.isArray(visitFrequencyData) ? visitFrequencyData : [];
  const safeAvgDurationData = Array.isArray(avgDurationByDept) ? avgDurationByDept : [];
  const safePeakTimesData = Array.isArray(peakTimesByType) ? peakTimesByType : [];
  const safeNewVsReturningData = Array.isArray(newVsReturningData) ? newVsReturningData : [];

  const processedDepartmentData = safeDepartmentData.length > 0 ? safeDepartmentData.map((item, index) => ({
    ...item,
    color: DEPARTMENT_COLORS[item.name] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
  })) : [
    { name: 'CEAFA', value: 45, color: '#ef4444' },
    { name: 'CHS', value: 30, color: '#10b981' },
    { name: 'CASE', value: 15, color: '#3b82f6' },
    { name: 'CBMA', value: 10, color: '#facc15' }
  ];

  const processedProgramData = safeProgramData.length > 0 ? safeProgramData.map((item, index) => ({
    ...item,
    color: PROGRAM_COLORS[index % PROGRAM_COLORS.length]
  })) : [
    { name: 'BSIT', value: 120 },
    { name: 'BSCS', value: 95 },
    { name: 'BSBA', value: 80 },
    { name: 'BSOA', value: 65 },
    { name: 'BSHRM', value: 50 },
    { name: 'BSCrim', value: 40 },
    { name: 'ABMassComm', value: 35 },
    { name: 'ABPsych', value: 25 }
  ];

  const processedYearLevelData = safeYearLevelData.length > 0 ? safeYearLevelData.map((item, index) => ({
    ...item,
    color: YEAR_LEVEL_COLORS[index % YEAR_LEVEL_COLORS.length]
  })) : [
    { name: '1st Year', value: 150, color: '#3b82f6' },
    { name: '2nd Year', value: 120, color: '#10b981' },
    { name: '3rd Year', value: 85, color: '#f59e0b' },
    { name: '4th Year', value: 60, color: '#8b5cf6' }
  ];

  const processedVisitFrequencyData = safeVisitFrequencyData.length > 0 ? safeVisitFrequencyData.map((item, index) => ({
    ...item,
    color: DEFAULT_COLORS[index % DEFAULT_COLORS.length]
  })) : [
    { name: 'CEAFA', visits: 450 },
    { name: 'CHS', visits: 380 },
    { name: 'CASE', visits: 290 },
    { name: 'CBMA', visits: 180 }
  ];

  const processedAvgDurationData = safeAvgDurationData.length > 0 ? safeAvgDurationData.map((item, index) => ({
    ...item,
    color: DEPARTMENT_COLORS[item.name] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
  })) : [
    { name: 'CEAFA', avgDuration: 45 },
    { name: 'CHS', avgDuration: 52 },
    { name: 'CASE', avgDuration: 38 },
    { name: 'CBMA', avgDuration: 30 }
  ];

  const processedPeakTimesData = safePeakTimesData.length > 0 ? safePeakTimesData.map((item, index) => ({
    ...item,
    color: PROGRAM_COLORS[index % PROGRAM_COLORS.length]
  })) : [
    { timeSlot: '8AM-12PM', morning: 120, afternoon: 0, evening: 0 },
    { timeSlot: '12PM-4PM', morning: 0, afternoon: 150, evening: 0 },
    { timeSlot: '4PM-8PM', morning: 0, afternoon: 0, evening: 100 }
  ];

  const processedNewVsReturningData = safeNewVsReturningData.length > 0 ? safeNewVsReturningData.map((item, index) => ({
    ...item,
    color: index === 0 ? '#10b981' : '#f59e0b'
  })) : [
    { name: 'Returning', value: 280, color: '#10b981' },
    { name: 'New', value: 135, color: '#f59e0b' }
  ];

  return (
    <div className="space-y-6">
      {/* Department Breakdown - Full Width */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500 min-h-[450px]">
        <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
          <Building2 className="w-6 h-6 text-blue-500" />
          <span>Department Distribution</span>
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.departmentDistribution.description} />
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="min-h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height={isMobile ? 280 : 340}>
              <RePieChart>
                <Pie
                  data={processedDepartmentData}
                  cx="50%" cy="50%"
                  labelLine={true}
                  label={({ name, percent, x, y }) => {
                    const text = `${name} ${(percent * 100).toFixed(0)}%`;
                    return (
                      <text x={x} y={y} fill="#111827" fontSize={12} fontWeight={500} textAnchor="middle">
                        {text.length > 25 ? text.substring(0, 22) + '...' : text}
                      </text>
                    );
                  }}
                  outerRadius={70}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {processedDepartmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {processedDepartmentData.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="font-medium text-gray-800">{item.name}</span>
                </div>
                <span className="text-gray-600">{String(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Other Cards in 2-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Repeat vs Unique Visitors */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500 min-h-[450px]">
          <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
            <Repeat className="w-6 h-6 text-purple-500" />
            <span>Repeat vs. Unique Visitors</span>
            <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.repeatVsUnique.description} />
          </h3>
          <div className="flex items-center justify-center py-4">
            <div className="w-full max-w-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 font-medium">Unique Visitors</span>
                <span className="text-gray-800 font-bold">{uniqueVisitRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                <div 
                  className="bg-blue-500 h-6 rounded-l-full transition-all"
                  style={{ width: `${uniqueVisitRate}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between mt-4 mb-2">
                <span className="text-gray-600 font-medium">Repeat Visitors</span>
                <span className="text-gray-800 font-bold">{repeatVisitRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                <div 
                  className="bg-purple-500 h-6 rounded-l-full transition-all"
                  style={{ width: `${repeatVisitRate}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Visiting Programs/Major */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500 min-h-[450px]">
          <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
            <GraduationCap className="w-6 h-6 text-indigo-500" />
            <span>Top Visiting Programs/Major</span>
          </h3>
          <ResponsiveContainer width="100%" height={isMobile ? 280 : 350}>
            <BarChart data={processedProgramData} layout="vertical" margin={{ top: 10, right: 20, left: 80, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={true} vertical={false} />
              <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" stroke="#6b7280" tick={{ fontSize: 11 }} width={75} />
              <Tooltip formatter={(value: any) => [`${value} visits`, 'Total Visits']} />
              <Bar dataKey="value" fill="#6366f1" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Year Level Distribution */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500 min-h-[450px]">
          <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
            <Users className="w-6 h-6 text-green-500" />
            <span>Year Level Distribution</span>
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 min-h-[300px]">
              <ResponsiveContainer width="100%" height={isMobile ? 250 : 320}>
                <RePieChart>
                   <Pie
                     data={processedYearLevelData}
                     cx="50%" cy="50%"
                     labelLine={true}
                     label={({ name, percent, x, y }) => {
                       const text = `${name} ${(percent * 100).toFixed(0)}%`;
                       return (
                         <text x={x} y={y} fill="#111827" fontSize={12} fontWeight={500} textAnchor="middle">
                           {text.length > 25 ? text.substring(0, 22) + '...' : text}
                         </text>
                       );
                     }}
                     outerRadius={90}
                     fill="#8884d8"
                     dataKey="value"
                   >
                    {processedYearLevelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
            </div>
            <div className="lg:col-span-2 space-y-3">
              {processedYearLevelData.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="font-medium text-gray-800">{item.name}</span>
                  </div>
                  <span className="text-gray-600">{String(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Visit Frequency by Department */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500 min-h-[450px]">
          <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
            <TrendingUp className="w-6 h-6 text-orange-500" />
            <span>Visit Frequency by Department</span>
          </h3>
          <ResponsiveContainer width="100%" height={isMobile ? 280 : 350}>
            <BarChart data={processedVisitFrequencyData} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" stroke="#6b7280" tick={{ fontSize: 11 }} />
              <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: any) => [`${value} visits`, 'Frequency']} />
              <Bar dataKey="visits" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Average Visit Duration by Department */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500 min-h-[450px]">
          <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
            <Clock className="w-6 h-6 text-cyan-500" />
            <span>Average Visit Duration by Department</span>
          </h3>
          <ResponsiveContainer width="100%" height={isMobile ? 280 : 350}>
            <BarChart data={processedAvgDurationData} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" stroke="#6b7280" tick={{ fontSize: 11 }} />
              <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: any) => [`${value} minutes`, 'Avg Duration']} />
              <Bar dataKey="avgDuration" fill="#14b8a6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Peak Visit Times by Student Type */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500 min-h-[450px]">
          <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
            <Users className="w-6 h-6 text-pink-500" />
            <span>Peak Visit Times by Student Type</span>
          </h3>
          <ResponsiveContainer width="100%" height={isMobile ? 280 : 350}>
            <BarChart data={processedPeakTimesData} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="timeSlot" stroke="#6b7280" tick={{ fontSize: 11 }} />
              <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: any, name: string) => [`${value} visits`, name]} />
              <Bar dataKey="morning" stackId="a" fill="#f472b6" name="Morning" />
              <Bar dataKey="afternoon" stackId="a" fill="#a78bfa" name="Afternoon" />
              <Bar dataKey="evening" stackId="a" fill="#34d399" name="Evening" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* New vs Returning Students */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500 min-h-[450px]">
          <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
            <UserCheck className="w-6 h-6 text-emerald-500" />
            <span>New vs Returning Students</span>
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 min-h-[300px]">
              <ResponsiveContainer width="100%" height={isMobile ? 250 : 320}>
                <RePieChart>
                   <Pie
                     data={processedNewVsReturningData}
                     cx="50%" cy="50%"
                     labelLine={true}
                     label={({ name, percent, x, y }) => {
                       const text = `${name} ${(percent * 100).toFixed(0)}%`;
                       return (
                         <text x={x} y={y} fill="#111827" fontSize={12} fontWeight={500} textAnchor="middle">
                           {text.length > 25 ? text.substring(0, 22) + '...' : text}
                         </text>
                       );
                     }}
                     outerRadius={90}
                     fill="#8884d8"
                     dataKey="value"
                   >
                    {processedNewVsReturningData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
            </div>
            <div className="lg:col-span-2 space-y-3">
              {processedNewVsReturningData.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="font-medium text-gray-800">{item.name}</span>
                  </div>
                  <span className="text-gray-600">{String(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}