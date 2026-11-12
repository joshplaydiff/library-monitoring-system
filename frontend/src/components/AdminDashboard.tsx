import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Switch } from './ui/switch';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Users, FileText, LogOut, RefreshCw, Clock, Sun, Moon, User, Calendar, TrendingUp, Activity, BarChart3, PieChart, Target, Timer, TrendingDown, Menu, ChevronDown, ChevronLeft, ChevronRight, Flame, Building2, GraduationCap, Wifi, WifiOff, Battery, BatteryCharging, AlertTriangle, CheckCircle, Clock3, Library, Gauge, BookMarked, History, Filter, ArrowUpRight, ArrowDownRight, Minus, Percent, Eye, Zap, Repeat, UserCheck, UserPlus, Shield, Database, HardDrive, Server, Laptop, Landmark, FileDown, X, Bell } from 'lucide-react';
import { getAnalytics, syncLogs, getAdminTransactions, approveTransaction, rejectTransaction, returnBook, getFines, clearFine, getNotifications } from '../utils/api';
import { ActiveUsersIndicator } from './ActiveUsersIndicator';
import { AppFooter } from './AppFooter';
import { HistoricalTrendAnalysis } from './HistoricalTrendAnalysis';
import { DepartmentAnalyticsSection } from './DepartmentAnalytics';
import { CapacityPlanning } from './CapacityPlanning';
import { EngagementScoring } from './EngagementScoring';
import PurposeAnalytics from './PurposeAnalytics';
import TimeBasedAnalytics from './TimeBasedAnalytics';
import { HeatMetrics } from './HeatMetrics';
import { StudentInsights } from './StudentInsights';
import { SystemHealth } from './SystemHealth';
import { SpaceUtilization } from './SpaceUtilization';
import { UserBehaviorAnalytics } from './UserBehaviorAnalytics';
import { ExportReports } from './ExportReports';
import { RoomsSection } from './RoomsSection';
import { CatalogingPage } from './CatalogingPage';
import { useIsMobile } from './ui/use-mobile';
import { useRealTimeData } from '../context/RealTimeContext';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  PieChart as RePieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  BarChart, 
  Bar,
  ComposedChart,
} from 'recharts';

interface AdminDashboardProps {
  isOnline: boolean;
  queuedCount: number;
  clearQueue: () => void;
  onLogout: () => void;
}

type AnalyticsSection = 'overview' | 'heat' | 'students' | 'sync' | 'space' | 'trends' | 'behavior' | 'department' | 'capacity' | 'engagement' | 'purpose' | 'time' | 'export' | 'transactions' | 'rooms' | 'cataloging';

const analyticsSections = [
  { id: 'overview', label: 'Overview', icon: BarChart3, color: '#fbbf24' },
  { id: 'heat', label: 'Heat Metrics', icon: Flame, color: '#f97316' },
  { id: 'students', label: 'Students', icon: GraduationCap, color: '#3b82f6' },
  { id: 'sync', label: 'Sync & Health', icon: Wifi, color: '#22c55e' },
  { id: 'space', label: 'Space & Resources', icon: Building2, color: '#a855f7' },
  { id: 'trends', label: 'Historical Trends', icon: TrendingUp, color: '#06b6d4' },
  { id: 'behavior', label: 'User Behavior', icon: Users, color: '#ec4899' },
  { id: 'department', label: 'Department', icon: Landmark, color: '#6366f1' },
  { id: 'capacity', label: 'Capacity Planning', icon: Gauge, color: '#ef4444' },
  { id: 'engagement', label: 'User Engagement', icon: Zap, color: '#eab308' },
  { id: 'purpose', label: 'Purpose Analytics', icon: Target, color: '#14b8a6' },
  { id: 'time', label: 'Time Analytics', icon: Clock, color: '#0ea5e9' },
  { id: 'transactions', label: 'Transactions', icon: BookMarked, color: '#f59e0b' },
  { id: 'rooms', label: 'Rooms & Sections', icon: Building2, color: '#a855f7' },
  { id: 'export', label: 'Export Reports', icon: FileDown, color: '#22c55e' },
  { id: 'cataloging', label: 'Cataloging', icon: BookMarked, color: '#8b5cf6' },
];

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
  const percentage = max > 0 ? (current / max) * 100 : 0;
  if (percentage >= 90) return { status: 'critical', color: '#ef4444', label: 'Critical' };
  if (percentage >= 80) return { status: 'warning', color: '#f59e0b', label: 'Warning' };
  return { status: 'normal', color: '#10b981', label: 'Normal' };
};

export function AdminDashboard({ isOnline, queuedCount, clearQueue, onLogout }: AdminDashboardProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { realTimeData, connectionStatus, subscribe, unsubscribe } = useRealTimeData();
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [menuOpen, setMenuOpen] = useState(false);
  const [analyticsMenuOpen, setAnalyticsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<AnalyticsSection>('overview');
  const [sectionKey, setSectionKey] = useState(0);
  const [drillDownData, setDrillDownData] = useState<any>(null);
  const [isDrillingDown, setIsDrillingDown] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [fines, setFines] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [txFilter, setTxFilter] = useState('pending');
  const [txError, setTxError] = useState<string | null>(null);

  const sectionIds = analyticsSections.map(s => s.id);
  const currentIndex = sectionIds.indexOf(activeSection);

  const goToPreviousSection = () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : sectionIds.length - 1;
    setActiveSection(sectionIds[newIndex] as AnalyticsSection);
    setSectionKey(prev => prev + 1);
  };

  const goToNextSection = () => {
    const newIndex = currentIndex < sectionIds.length - 1 ? currentIndex + 1 : 0;
    setActiveSection(sectionIds[newIndex] as AnalyticsSection);
    setSectionKey(prev => prev + 1);
  };

  const loadAnalytics = async () => {
    setLoading(true);
    const result = await getAnalytics('week');
    
    if (result.success && result.data) {
      setAnalytics(result.data);
    } else {
      console.error('Failed to load analytics:', result.error);
      setAnalytics({
        totalVisits: 0,
        entries: 0,
        exits: 0,
        currentlyInside: 0,
        peakDay: {},
        peakHour: {},
        dailyBreakdown: [],
        hourlyDistribution: {},
        userTypeDistribution: {},
        purposeDistribution: {},
        engagementMetrics: {},
        averageDailyVisits: 0
      });
    }
    setLoading(false);
  };

  // Fetch analytics data
  useEffect(() => {
    loadAnalytics();
  }, [isOnline]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Subscribe to real-time updates when component mounts
  useEffect(() => {
    subscribe();
    return () => {
      unsubscribe();
    };
  }, [subscribe, unsubscribe]);

  // Update analytics with real-time data (instant updates with zero delay)
  useEffect(() => {
    if (!analytics) {
      if (realTimeData.currentlyInside > 0 || Object.keys(realTimeData.hourlyDistribution || {}).length > 0) {
        setAnalytics({
          currentlyInside: realTimeData.currentlyInside,
          todayVisits: realTimeData.todayVisits,
          hourlyDistribution: realTimeData.hourlyDistribution || {},
          dailyBreakdown: realTimeData.dailyBreakdown || [],
          engagementMetrics: realTimeData.engagementMetrics || {}
        });
      }
      return;
    }

    // Update with real-time data for instant updates - skip if no changes
    setAnalytics((prev: any) => {
      const newCurrentlyInside = realTimeData.currentlyInside ?? prev?.currentlyInside;
      const newTodayVisits = realTimeData.todayVisits ?? prev?.todayVisits;
      const newHourlyDistribution = realTimeData.hourlyDistribution || prev?.hourlyDistribution;
      const newDailyBreakdown = realTimeData.dailyBreakdown || prev?.dailyBreakdown;
      const newEngagementMetrics = {
        ...prev?.engagementMetrics,
        ...realTimeData.engagementMetrics
      };

      // Only update if there are actual changes
      if (
        newCurrentlyInside === prev?.currentlyInside &&
        newTodayVisits === prev?.todayVisits &&
        JSON.stringify(newHourlyDistribution) === JSON.stringify(prev?.hourlyDistribution) &&
        JSON.stringify(newDailyBreakdown) === JSON.stringify(prev?.dailyBreakdown)
      ) {
        return prev;
      }

      return {
        ...prev,
        currentlyInside: newCurrentlyInside,
        todayVisits: newTodayVisits,
        totalVisits: newTodayVisits,
        hourlyDistribution: newHourlyDistribution,
        dailyBreakdown: newDailyBreakdown,
        engagementMetrics: newEngagementMetrics
      };
    });
  }, [realTimeData]);

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const loadTransactions = useCallback(async () => {
    setTxError(null);
    const result = await getAdminTransactions({ status: txFilter, limit: 50 });
    if (result.success) {
      setTransactions(result.data || []);
    } else {
      setTxError(result.error || 'Failed to load transactions');
    }
  }, [txFilter]);

  const loadFines = useCallback(async () => {
    const result = await getFines({ limit: 50 });
    if (result.success) setFines(result.data || []);
  }, []);

  const loadNotifications = useCallback(async () => {
    const result = await getNotifications();
    if (result.success) setNotifications(result.data || []);
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    if (activeSection === 'transactions') {
      loadTransactions();
      loadFines();
      loadNotifications();
    }
  }, [activeSection, txFilter, loadTransactions, loadFines, loadNotifications]);

  // Fetch analytics data
  useEffect(() => {
    loadAnalytics();
  }, [isOnline]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleDrillDown = useCallback((data: any, type: string) => {
    setDrillDownData({ ...data, type });
    setIsDrillingDown(true);
  }, []);

  const handleBackFromDrillDown = useCallback(() => {
    setIsDrillingDown(false);
    setDrillDownData(null);
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    const queuedLogs = localStorage.getItem('queuedLogs');
    if (queuedLogs) {
      const logs = JSON.parse(queuedLogs);
      const result = await syncLogs(logs);
      if (result.success) {
        clearQueue();
        await loadAnalytics();
      }
    }
    setSyncing(false);
  }, [clearQueue, loadAnalytics]);

  // Memoized processed analytics data
  const processedData = useMemo(() => {
    if (!analytics) return null;

    const dailyBreakdown = analytics.dailyBreakdown || [];
    const peakDay = analytics.peakDay || {};
    const peakHour = analytics.peakHour || {};
    const engagementMetrics = analytics.engagementMetrics || {};

    const dailyVisits = dailyBreakdown.length > 0 ? dailyBreakdown.map((day: any) => {
      const visits = typeof day.visits === 'number' && !isNaN(day.visits) ? day.visits : 0;
      const uniqueUsers = typeof day.unique_users === 'number' && !isNaN(day.unique_users) ? day.unique_users : 0;
      const averageDuration = typeof day.average_duration === 'number' && !isNaN(day.average_duration) ? day.average_duration : 30;
      return {
        day: day.day ? day.day.substring(0, 3) : 'N/A',
        fullDay: day.day || 'Unknown',
        visits,
        uniqueUsers,
        averageDuration
      };
    }) : [{
      day: 'Mon',
      fullDay: 'Monday',
      visits: typeof analytics.totalVisits === 'number' && !isNaN(analytics.totalVisits) ? analytics.totalVisits : 0,
      uniqueUsers: typeof analytics.uniqueUsers === 'number' && !isNaN(analytics.uniqueUsers) ? analytics.uniqueUsers : 0,
      averageDuration: 30
    }];

    const peakHours = analytics.hourlyDistribution && Object.keys(analytics.hourlyDistribution).length > 0 ? 
      Object.entries(analytics.hourlyDistribution).map(([hour, count]) => {
        const hourNum = parseInt(hour);
        const countValue = typeof count === 'number' && !isNaN(count) ? count : 0;
        return {
          hour: isNaN(hourNum) ? 'N/A' : formatHour(hourNum),
          hour24: isNaN(hourNum) ? 0 : hourNum,
          count: countValue,
          isActive: !isNaN(hourNum) && hourNum === peakHour?.hour
        };
      }).sort((a, b) => a.hour24 - b.hour24) : [];

    // Enhanced user type data with trends
    const userTypeData = analytics.userTypeDistribution && Object.keys(analytics.userTypeDistribution).length > 0 ?
      Object.entries(analytics.userTypeDistribution).map(([name, value], index) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: typeof value === 'number' && !isNaN(value) ? value : 0,
        color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][index % 4]
      })) : [];

    // Enhanced purpose data with trends
    const purposeData = analytics.purposeDistribution && Object.keys(analytics.purposeDistribution).length > 0 ?
      Object.entries(analytics.purposeDistribution).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' '),
        value
      })) : [];

    // Enhanced department data with trends
    const departmentData = analytics.departmentDistribution && Object.keys(analytics.departmentDistribution).length > 0 ?
      Object.entries(analytics.departmentDistribution).map(([name, value], index) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: typeof value === 'number' ? value : 0,
        color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'][index % 7]
      })) : [];

    // Program/Major distribution
    const programData = analytics.programDistribution && Object.keys(analytics.programDistribution).length > 0 ?
      Object.entries(analytics.programDistribution)
        .map(([name, value]) => ({
          name: name.length > 20 ? name.substring(0, 20) + '...' : name,
          fullName: name,
          value: typeof value === 'number' ? value : 0
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8) : [];

    // Year Level distribution
    const yearLevelData = analytics.yearLevelDistribution && Object.keys(analytics.yearLevelDistribution).length > 0 ?
      Object.entries(analytics.yearLevelDistribution).map(([name, value], index) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: typeof value === 'number' ? value : 0
      })) : [];

    // Visit Frequency by Department
    const visitFrequencyData = analytics.visitFrequencyByDepartment && Object.keys(analytics.visitFrequencyByDepartment).length > 0 ?
      Object.entries(analytics.visitFrequencyByDepartment).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        visits: typeof value === 'number' ? value : 0
      })) : [];

    // Average Visit Duration by Department
    const avgDurationByDept = analytics.avgDurationByDepartment && Object.keys(analytics.avgDurationByDepartment).length > 0 ?
      Object.entries(analytics.avgDurationByDepartment).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        avgDuration: typeof value === 'number' ? Math.round(value) : 0
      })) : [];

    // Peak Visit Times by Student Type
    const peakTimesByType = analytics.peakTimesByStudentType && Object.keys(analytics.peakTimesByStudentType).length > 0 ?
      Object.entries(analytics.peakTimesByStudentType).map(([timeSlot, data]: [string, any]) => ({
        timeSlot,
        morning: data?.morning || 0,
        afternoon: data?.afternoon || 0,
        evening: data?.evening || 0
      })) : [];

    // New vs Returning Students
    const newVsReturningData = [
      { name: 'Returning', value: analytics.returningStudents || 0 },
      { name: 'New', value: analytics.newStudents || 0 }
    ];

    // Enhanced stats with new metrics
    const stats = [
      { 
        label: 'Total Visits This Week', 
        value: analytics.totalVisits?.toString() || '0', 
        change: `${analytics.averageDailyVisits || 0} avg/day`, 
        icon: Users,
        color: 'bg-blue-500',
        trend: analytics.totalVisits > 0 ? 'up' : 'neutral'
      },
      { 
        label: 'Currently Inside', 
        value: analytics.currentlyInside?.toString() || '0', 
        change: `${analytics.exits || 0} exits today`, 
        icon: Clock,
        color: 'bg-green-500',
        trend: 'stable'
      },
      { 
        label: 'Peak Day', 
        value: peakDay?.day || 'N/A', 
        change: `${peakDay?.visits || 0} visits (${peakDay?.percentage || 0}%)`, 
        icon: TrendingUp,
        color: 'bg-yellow-500',
        trend: 'up'
      },
      { 
        label: 'Unique Visitors', 
        value: analytics.uniqueUsers?.toString() || '0', 
        change: `${engagementMetrics?.repeatVisitRate || 0}% repeat`, 
        icon: Target,
        color: 'bg-purple-500',
        trend: engagementMetrics?.repeatVisitRate > 0 ? 'up' : 'neutral'
      }
    ];

    return {
      dailyBreakdown,
      peakDay,
      peakHour,
      engagementMetrics,
      dailyVisits,
      peakHours,
      userTypeData,
      purposeData,
      departmentData,
      programData,
      yearLevelData,
      visitFrequencyData,
      avgDurationByDept,
      peakTimesByType,
      newVsReturningData,
      stats
    };
  }, [analytics]);

  if (loading) {
    return (
      <div className="min-h-screen animated-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!processedData) {
    return null;
  }

  const {
    dailyBreakdown,
    peakDay,
    peakHour,
    engagementMetrics,
    dailyVisits,
    peakHours,
    userTypeData,
    purposeData,
    departmentData,
    programData,
    yearLevelData,
    visitFrequencyData,
    avgDurationByDept,
    peakTimesByType,
    newVsReturningData,
    stats
  } = processedData;

  // User Behavior Analytics Section
  const renderUserBehaviorSection = () => {
    const userBehavior = analytics?.userBehavior || {};
    const avgDurationByUserType = userBehavior.avgDurationByUserType || {};
    const peakUsageByDepartment = userBehavior.peakUsageByDepartment || {};
    const topPurposesByUserType = userBehavior.topPurposesByUserType || {};
    const retentionRate = userBehavior.retentionRate || { rate: 0, retainedUsers: 0, previousUsers: 0 };
    const visitorRatio = userBehavior.visitorRatio || { firstTime: { count: 0, percentage: 0 }, returning: { count: 0, percentage: 0 } };

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
      <div className="space-y-6">
        {/* Average Session Duration by User Type */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500">
          <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
            <Timer className="w-6 h-6 text-blue-500" />
            <span>Average Session Duration by User Type</span>
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
        <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500">
          <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
            <Building2 className="w-6 h-6 text-green-500" />
            <span>Peak Usage Times by Department</span>
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
        <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-purple-500">
          <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
            <Target className="w-6 h-6 text-purple-500" />
            <span>Top Visit Purposes by User Type</span>
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
        <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-teal-500">
          <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
            <Repeat className="w-6 h-6 text-teal-500" />
            <span>User Retention Rate</span>
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
        <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-orange-500">
          <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
            <UserCheck className="w-6 h-6 text-orange-500" />
            <span>First-time vs Returning Visitors</span>
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
  };

  // Render section content based on active section
  const renderSectionContent = () => {
    if (isDrillingDown && drillDownData) {
      return (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <button 
            onClick={handleBackFromDrillDown}
            className="mb-4 flex items-center space-x-2 text-blue-600 hover:text-blue-800"
          >
            <ChevronDown className="w-5 h-5 rotate-90" />
            <span>Back to Overview</span>
          </button>
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            Detailed View: {drillDownData.type}
          </h3>
          <div className="text-gray-600">
            <pre className="bg-gray-100 p-4 rounded-lg overflow-auto">
              {JSON.stringify(drillDownData, null, 2)}
            </pre>
          </div>
        </div>
      );
    }

    switch (activeSection) {
      case 'heat':
        return (
          <HeatMetrics
            analytics={analytics}
            peakHours={peakHours}
            dailyVisits={dailyVisits}
            engagementMetrics={engagementMetrics}
            handleDrillDown={handleDrillDown}
          />
        );
      case 'students':
        return (
          <StudentInsights
            analytics={analytics}
            engagementMetrics={engagementMetrics}
            departmentData={departmentData}
            programData={programData}
            yearLevelData={yearLevelData}
            visitFrequencyData={visitFrequencyData}
            avgDurationByDept={avgDurationByDept}
            peakTimesByType={peakTimesByType}
            newVsReturningData={newVsReturningData}
          />
        );
      case 'sync':
        return (
          <SystemHealth
            isOnline={isOnline}
            queuedCount={queuedCount}
            analytics={analytics}
            syncing={syncing}
            onSync={handleSync}
            onClearQueue={clearQueue}
          />
        );
      case 'space':
        return <SpaceUtilization analytics={analytics} />;
      case 'trends':
        return <HistoricalTrendAnalysis analytics={analytics} loading={loading} />;
      case 'behavior':
        return <UserBehaviorAnalytics analytics={analytics} />;
      case 'department':
        return <DepartmentAnalyticsSection analytics={analytics} />;
      case 'capacity':
        return <CapacityPlanning analytics={analytics} loading={loading} />;
      case 'engagement':
        return <EngagementScoring analytics={analytics} loading={loading} />;
      case 'purpose':
        return analytics?.purposeAnalytics ? (
          <PurposeAnalytics purposeAnalytics={analytics.purposeAnalytics} />
        ) : (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Purpose Analytics</h3>
            <div className="text-center py-8 text-gray-500">No purpose analytics data available</div>
          </div>
        );
      case 'time':
        return analytics?.timeBasedAnalytics ? (
          <TimeBasedAnalytics timeBasedAnalytics={analytics.timeBasedAnalytics} />
        ) : (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Time-Based Analytics</h3>
            <div className="text-center py-8 text-gray-500">No time-based analytics data available</div>
          </div>
        );
      case 'rooms':
        return <RoomsSection />;
      case 'export':
        return <ExportReports analytics={analytics} isOnline={isOnline} />;
      case 'transactions':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">Borrowing Requests</h3>
                <div className="flex gap-2">
                  {['pending', 'active', 'returned', 'cancelled'].map(status => (
                    <button
                      key={status}
                      onClick={() => setTxFilter(status)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium capitalize transition-colors ${txFilter === status ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
              {txError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {txError}
                </div>
              )}
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No transactions found</div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx: any) => (
                    <div key={tx.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-gray-800">{tx.title}</h4>
                        <p className="text-sm text-gray-600">Student: {tx.full_name} ({tx.student_id})</p>
                        <p className="text-sm text-gray-600">Due: {tx.due_date}</p>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold capitalize ${tx.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : tx.status === 'active' ? 'bg-blue-100 text-blue-800' : tx.status === 'returned' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {tx.status}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {tx.status === 'pending' && (
                          <>
                            <button onClick={() => approveTransaction(tx.id).then(() => loadTransactions())} className="bg-green-500 hover:bg-green-600 text-white text-sm px-3 py-2 rounded-lg transition-colors">Approve</button>
                            <button onClick={() => rejectTransaction(tx.id, 'Rejected by librarian').then(() => loadTransactions())} className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-2 rounded-lg transition-colors">Reject</button>
                          </>
                        )}
                        {tx.status === 'active' && (
                          <button onClick={() => returnBook(tx.id).then(() => { loadTransactions(); loadFines(); })} className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-3 py-2 rounded-lg transition-colors">Mark Returned</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">Fines</h3>
              </div>
              {fines.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No fines found</div>
              ) : (
                <div className="space-y-3">
                  {fines.map((fine: any) => (
                    <div key={fine.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-gray-800">{fine.book_title || 'Fine'}</h4>
                        <p className="text-sm text-gray-600">Student: {fine.full_name} ({fine.student_id})</p>
                        <p className="text-sm text-gray-600">Amount: ₱{fine.amount}</p>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold capitalize ${fine.status === 'unpaid' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                          {fine.status}
                        </span>
                      </div>
                      {fine.status === 'unpaid' && (
                        <button onClick={() => clearFine(fine.id).then(() => loadFines())} className="bg-green-500 hover:bg-green-600 text-white text-sm px-3 py-2 rounded-lg transition-colors">Mark Paid</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      case 'cataloging':
        return <CatalogingPage />;
      default:
        return null;
    }
  };

  // Heat Metrics Section
  const renderHeatMetricsSection = () => {
    const currentOccupancy = analytics?.currentlyInside || 0;
    const maxCapacity = analytics?.maxCapacity || 150;
    const occupancyStatus = calculateCapacityStatus(currentOccupancy, maxCapacity);

    return (
      <div className="space-y-6">
        {/* Real-time Occupancy */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2">
              <Flame className="w-6 h-6 text-orange-500" />
              <span>Real-time Occupancy</span>
            </h3>
            <span 
              className="px-3 py-1 rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: occupancyStatus.color }}
            >
              {occupancyStatus.label}
            </span>
          </div>
          <div className="flex items-center justify-center py-8">
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
                  stroke={occupancyStatus.color}
                  strokeWidth="16"
                  fill="none"
                  strokeDasharray={`${(currentOccupancy / maxCapacity) * 502} 502`}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-gray-800">
                  {currentOccupancy}
                </span>
                <span className="text-gray-500">/ {maxCapacity}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Peak Traffic Hours Chart */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2">
              <Clock3 className="w-6 h-6 text-yellow-500" />
              <span>Peak Traffic Hours</span>
            </h3>
            <button 
              onClick={() => handleDrillDown(peakHours, 'Peak Hours')}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
            >
              <Filter className="w-4 h-4" />
              <span>Drill Down</span>
            </button>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={peakHours} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
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
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2">
              <Calendar className="w-6 h-6 text-purple-500" />
              <span>Busiest Days of the Week</span>
            </h3>
            <button 
              onClick={() => handleDrillDown(dailyVisits, 'Busiest Days')}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
            >
              <Filter className="w-4 h-4" />
              <span>Drill Down</span>
            </button>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dailyVisits} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="day" stroke="#6b7280" tick={{ fontSize: 12 }} />
              <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: any) => [`${value} visits`, 'Traffic']} />
              <Bar dataKey="visits" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Average Dwell Time */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500">
          <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
            <Timer className="w-6 h-6 text-green-500" />
            <span>Average Dwell Time</span>
          </h3>
          <div className="flex items-center justify-center py-4">
            <div className="text-center">
              <div className="text-5xl font-bold text-green-600 mb-2">
                {engagementMetrics?.averageVisitDuration || 0}m
              </div>
              <p className="text-gray-500">Average time students spend in library</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Student Insights Section
  const renderStudentInsightsSection = () => {
    // Use real analytics data for student insights
    const userTypeDistribution = analytics?.userTypeDistribution || {};
    const repeatVisitRate = engagementMetrics?.repeatVisitRate || 0;
    const uniqueVisitRate = 100 - repeatVisitRate;

    return (
      <div className="space-y-6">
        {/* Department Breakdown */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
            <Building2 className="w-6 h-6 text-blue-500" />
            <span>Department Distribution</span>
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={250}>
              <RePieChart>
                <Pie
                  data={departmentData}
                  cx="50%"
                  cy="50%"
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
                  {departmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
            <div className="space-y-3">
              {departmentData.map((item, index) => (
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

        {/* Repeat vs Unique Visitors */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
            <Repeat className="w-6 h-6 text-purple-500" />
            <span>Repeat vs. Unique Visitors</span>
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
      </div>
    );
  };

  // System Health Section
  const renderSystemHealthSection = () => {
    // Use real analytics data for system health
    const totalLogs = analytics?.totalVisits || 0;
    const incompleteLogs = analytics?.incompleteLogs || 0;

    return (
      <div className="space-y-6">
        {/* Sync Status */}
        <div className={`bg-white rounded-2xl shadow-lg p-6 border-l-4 ${
          isOnline ? 'border-green-500' : 'border-red-500'
        }`}>
          <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
            {isOnline ? 
              <Wifi className="w-6 h-6 text-green-500" /> : 
              <WifiOff className="w-6 h-6 text-red-500" />
            }
            <span>Sync Status</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <p className="text-sm text-gray-500">Connection</p>
              <p className="font-bold text-gray-800">{isOnline ? 'Online' : 'Offline'}</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <Database className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Pending</p>
              <p className="font-bold text-gray-800">{queuedCount} logs</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <Shield className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Total Logs</p>
              <p className="font-bold text-gray-800">{totalLogs}</p>
            </div>
          </div>
        </div>

        {/* Data Integrity */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
            <Shield className="w-6 h-6 text-blue-500" />
            <span>Data Integrity Check</span>
          </h3>
          <div className="flex items-center justify-center py-4">
            <div className="text-center">
              <div className={`text-5xl font-bold mb-2 ${
                incompleteLogs > 5 ? 'text-red-500' : 'text-green-500'
              }`}>
                {incompleteLogs}
              </div>
              <p className="text-gray-500">Incomplete Logs (Scanned in but not out)</p>
              <p className="text-sm text-gray-400 mt-2">
                Total Logs: {totalLogs}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Space Utilization Section
  const renderSpaceUtilizationSection = () => {
    // Use real analytics data for space utilization
    const currentOccupancy = analytics?.currentlyInside || 0;
    const maxCapacity = analytics?.maxCapacity || 150;
    const capacityPercentage = maxCapacity > 0 ? (currentOccupancy / maxCapacity) * 100 : 0;
    const capacityStatus = calculateCapacityStatus(currentOccupancy, maxCapacity);
    const totalVisits = analytics?.totalVisits || 0;
    const target = analytics?.target || 10000;
    const progressToTarget = target > 0 ? (totalVisits / target) * 100 : 0;

    return (
      <div className="space-y-6">
        {/* Capacity Alerts Gauge */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4" style={{ borderLeftColor: capacityStatus.color }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2">
              <Gauge className="w-6 h-6" style={{ color: capacityStatus.color }} />
              <span>Capacity Alerts</span>
            </h3>
            <span 
              className="px-3 py-1 rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: capacityStatus.color }}
            >
              {capacityPercentage >= 90 ? 'CRITICAL' : capacityPercentage >= 80 ? 'WARNING' : 'NORMAL'}
            </span>
          </div>
          <div className="flex items-center justify-center py-6">
            <div className="relative w-64">
              {/* Gauge Background */}
              <div className="w-full h-8 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-green-500" style={{ width: '80%' }}></div>
              </div>
              {/* Current Position Marker */}
              <div 
                className="absolute top-0 w-4 h-8 bg-gray-800 rounded-full transform -translate-x-1/2 transition-all duration-500"
                style={{ left: `${Math.min(capacityPercentage, 100)}%` }}
              ></div>
              {/* Labels */}
              <div className="flex justify-between mt-2 text-sm text-gray-600">
                <span>0%</span>
                <span className="text-yellow-500 font-medium">80% (Warning)</span>
                <span className="text-red-500 font-medium">90% (Critical)</span>
                <span>100%</span>
              </div>
            </div>
          </div>
          <div className="text-center mt-4">
            <p className="text-gray-600">Current Capacity: </p>
            <p className="text-3xl font-bold" style={{ color: capacityStatus.color }}>
              {currentOccupancy} / {maxCapacity}
            </p>
            <p className="text-gray-500">{capacityPercentage.toFixed(1)}%</p>
          </div>
        </div>

        {/* Benchmarking */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
            <History className="w-6 h-6 text-purple-500" />
            <span>Benchmarking (Year-over-Year)</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500">Current Year</p>
              <p className="text-2xl font-bold text-gray-800">{totalVisits.toLocaleString()}</p>
              <p className="text-sm text-gray-400">visits</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500">Target</p>
              <p className="text-2xl font-bold text-blue-600">{target.toLocaleString()}</p>
              <p className="text-sm text-gray-400">visits</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500">Progress</p>
              <p className="text-2xl font-bold text-green-600">{progressToTarget.toFixed(1)}%</p>
              <p className="text-sm text-gray-400">to target</p>
            </div>
          </div>
          {/* Progress to Target */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 font-medium">Progress to Target</span>
              <span className="text-gray-800 font-bold">
                {progressToTarget.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div 
                className="bg-blue-500 h-4 rounded-full transition-all"
                style={{ width: `${Math.min(progressToTarget, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen animated-gradient flex flex-col">
      {/* Mobile Navigation Drawer */}
      {isMobile && mobileNavOpen && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setMobileNavOpen(false)}>
          <div 
            className="fixed left-0 top-0 h-full w-72 shadow-2xl animate-in slide-in-from-left"
            style={{
              background: '#111827'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b-2 border-yellow-500">
              <h2 className="text-lg font-bold text-yellow-400">Analytics</h2>
              <button 
                onClick={() => setMobileNavOpen(false)}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-yellow-400" />
              </button>
            </div>
            <nav className="p-2 overflow-y-auto h-[calc(100%-64px)]">
              {analyticsSections.map((section) => {
                const Icon = section.icon;
                const sectionColor = section.color || '#fbbf24';
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => {
                      setActiveSection(section.id as AnalyticsSection);
                      setMobileNavOpen(false);
                    }}
                    className={`flex items-center space-x-3 w-full px-4 py-4 rounded-lg text-left transition-all mb-1 ${
                      isActive 
                        ? 'bg-yellow-500 text-white shadow-lg' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-600'}`} style={{ color: isActive ? 'white' : sectionColor }} />
                    <span className="font-medium">{section.label}</span>
                  </button>
                );
              })}
              <div className="border-t border-gray-300 my-4"></div>
              <button
                onClick={() => {
                  navigate('/admin/users');
                  setMobileNavOpen(false);
                }}
                className="flex items-center space-x-3 w-full px-4 py-4 rounded-lg text-left text-white hover:bg-white/20 mb-1"
              >
                <Users className="w-5 h-5 text-white" />
                <span className="font-medium text-white">Registered Users</span>
              </button>
              <button
                onClick={() => {
                  navigate('/admin/visit-logs');
                  setMobileNavOpen(false);
                }}
                className="flex items-center space-x-3 w-full px-4 py-4 rounded-lg text-left text-white hover:bg-white/20 mb-1"
              >
                <FileText className="w-5 h-5 text-white" />
                <span className="font-medium text-white">View Logs</span>
              </button>
              <button
                onClick={() => {
                  onLogout();
                  navigate('/');
                }}
                className="flex items-center space-x-3 w-full px-4 py-4 rounded-lg text-left text-red-400 hover:bg-red-500/20"
              >
                <LogOut className="w-5 h-5 text-white" />
                <span className="font-medium text-white">Logout</span>
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Header */}
      <header 
        className="sticky top-0 z-50 shadow-lg border-b-4 border-yellow-500"
        style={{
          background: '#111827'
        }}
      >
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-row items-center justify-between w-full gap-2 sm:gap-0">
            {/* Always use Desktop-style dropdown - applied to both Mobile and Desktop */}
            <div className="relative order-1">
              <button
                onClick={() => setAnalyticsMenuOpen(!analyticsMenuOpen)}
                onMouseEnter={() => setAnalyticsMenuOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-white transition-all duration-200 shadow-lg text-sm sm:text-base border border-yellow-400/50 hover:border-yellow-300 hover:shadow-yellow-500/25"
              >
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="font-medium hidden sm:inline">Analytics</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${analyticsMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {analyticsMenuOpen && (
                <div 
                  className="absolute left-0 mt-2 w-64 rounded-lg shadow-xl border-2 border-yellow-500 py-2 z-50 animate-fade-in h-[70vh] overflow-y-auto"
                  style={{ background: '#111827' }}
                  onMouseEnter={() => setAnalyticsMenuOpen(true)}
                  onMouseLeave={() => setAnalyticsMenuOpen(false)}
                >
                  {analyticsSections.map((section) => {
                    const Icon = section.icon;
                    const sectionColor = section.color || '#fbbf24';
                    const isActive = activeSection === section.id;
                    return (
                      <button
                        key={section.id}
                        onClick={() => {
                          setActiveSection(section.id as AnalyticsSection);
                          setAnalyticsMenuOpen(false);
                        }}
                        className={`flex items-center space-x-3 w-full px-4 py-2 text-left transition-all duration-200 focus:outline-none hover:scale-105 hover:shadow-lg ${
                          isActive 
                            ? 'bg-white/30 text-white shadow-inner' 
                            : 'text-white hover:bg-yellow-500/70 hover:text-white'
                        }`}
                      >
                        <Icon className="w-5 h-5 transition-transform duration-200" style={{ color: sectionColor }} />
                        <span className="font-medium">{section.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Title - Center - Always show full title like Desktop */}
            <div className="flex items-center justify-center flex-1 order-2 sm:order-2">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-8 h-8 sm:w-14 sm:h-14 text-yellow-500 flex-shrink-0 animate-pulse" />
                <div className="flex flex-col items-center">
                  <h1 className="text-xl sm:text-4xl md:text-6xl font-bold text-yellow-400">
                    Analytics Dashboard
                  </h1>
                  <p className="text-xs sm:text-base md:text-xl text-white text-center hidden sm:block">Library Monitoring System</p>
                </div>
                <BookOpen className="w-8 h-8 sm:w-14 sm:h-14 text-yellow-500 flex-shrink-0 animate-pulse" style={{ transform: 'scaleX(-1)' }} />
              </div>
            </div>

            {/* Notification Bell */}
            <div className="relative order-3 sm:order-3">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
              >
                <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
                {notifications.reduce((sum, n) => sum + (n.count || 0), 0) > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {notifications.reduce((sum, n) => sum + (n.count || 0), 0)}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div 
                  className="absolute right-0 mt-2 w-80 rounded-lg shadow-xl border-2 border-yellow-500 py-2 z-50 animate-fade-in max-h-96 overflow-y-auto"
                  style={{ background: '#111827' }}
                  onMouseEnter={() => setNotificationsOpen(true)}
                  onMouseLeave={() => setNotificationsOpen(false)}
                >
                  <div className="px-4 py-2 border-b border-gray-700">
                    <h3 className="text-white font-semibold">Notifications</h3>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-gray-400 text-sm">No notifications</div>
                  ) : (
                    notifications.map((notification) => (
                      <div key={notification.id} className="px-4 py-3 hover:bg-gray-700/50 transition-colors">
                        <p className="text-white text-sm">{notification.message}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Always show desktop-style Menu dropdown - applied to both Mobile and Desktop */}
            <div className="relative flex-shrink-0 order-4 sm:order-4">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                onMouseEnter={() => setMenuOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-white transition-all duration-200 shadow-lg text-sm sm:text-base border border-yellow-400/50 hover:border-yellow-300 hover:shadow-yellow-500/25"
              >
                <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="font-medium hidden sm:inline">Menu</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
              </button>
              {menuOpen && (
                <div 
                  className="absolute right-0 mt-2 w-48 rounded-lg shadow-xl border-2 border-yellow-500 py-2 z-50 animate-fade-in"
                  style={{
                    background: '#111827'
                  }}
                  onMouseEnter={() => setMenuOpen(true)}
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <button
                    onClick={() => {
                      navigate('/admin/users');
                      setMenuOpen(false);
                    }}
                    className="flex items-center space-x-3 w-full px-4 py-3 text-left text-white hover:bg-yellow-500/70 hover:text-white transition-all duration-200 hover:scale-105 hover:shadow-lg focus:outline-none"
                  >
                    <Users className="w-5 h-5 flex-shrink-0" style={{ color: '#3b82f6' }} />
                    <span className="font-medium">Registered Users</span>
                  </button>
                  <button
                    onClick={() => {
                      navigate('/admin/visit-logs');
                      setMenuOpen(false);
                    }}
                    className="flex items-center space-x-3 w-full px-4 py-3 text-left text-white hover:bg-yellow-500/70 hover:text-white transition-all duration-200 hover:scale-105 hover:shadow-lg focus:outline-none"
                  >
                    <FileText className="w-5 h-5 flex-shrink-0" style={{ color: '#a855f7' }} />
                    <span className="font-medium">View Logs</span>
                  </button>
                  <div className="border-t border-white/20 my-1"></div>
                  <button
                    onClick={() => {
                      onLogout();
                      navigate('/');
                    }}
                    className="flex items-center space-x-3 w-full px-4 py-3 text-left text-white hover:bg-red-500/70 hover:text-white transition-all duration-200 hover:scale-105 hover:shadow-lg focus:outline-none"
                  >
                    <LogOut className="w-5 h-5 flex-shrink-0" style={{ color: '#ef4444' }} />
                    <span className="font-medium">Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 flex-1">

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Section Navigation */}
            <div key={sectionKey} className="mb-4 flex items-center justify-center gap-3 animate-fade-in">
              <button
                onClick={goToPreviousSection}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-gray-600 to-gray-700 hover:from-yellow-500 hover:to-yellow-600 text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg border border-gray-500 hover:border-yellow-400"
                title="Previous section"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm font-medium hidden sm:inline">Prev</span>
              </button>
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-md border-2 border-yellow-500 transition-all duration-300 hover:shadow-lg">
                <span className="text-sm font-bold text-black">
                  {analyticsSections.find(s => s.id === activeSection)?.label || 'Overview'}
                </span>
              </div>
              <button
                onClick={goToNextSection}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-gray-600 to-gray-700 hover:from-yellow-500 hover:to-yellow-600 text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg border border-gray-500 hover:border-yellow-400"
                title="Next section"
              >
                <span className="text-sm font-medium hidden sm:inline">Next</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Current Date & Time Widget */}
            <div 
              className="mb-6 rounded-2xl border-4 border-yellow-500 bg-white p-4 sm:p-6 shadow-lg transition-all duration-300 hover:shadow-xl"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <div 
                    className="p-2 sm:p-3 rounded-xl flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
                  >
                    <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm sm:text-base font-medium text-black">Current Date & Time</p>
                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-black" style={{ fontFamily: 'monospace' }}>
                      {formatDateTime(currentTime)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-black">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-xs sm:text-sm font-medium">Live</span>
                </div>
              </div>
            </div>

            {/* Sync Status */}
            {queuedCount > 0 && (
              <div 
                className="mb-8 rounded-2xl border-4 border-yellow-500 p-6 shadow-lg transition-all duration-300 hover:shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-5">
                    <div 
                      className="p-3 rounded-xl"
                      style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
                    >
                      <RefreshCw className={`w-7 h-7 text-white ${syncing ? 'animate-spin' : ''}`} />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-yellow-900">
                        {queuedCount} log(s) pending sync
                      </p>
                      <p className="text-sm font-medium text-yellow-300">
                        {isOnline ? 'Ready to sync' : 'Will sync when connection is restored'}
                      </p>
                    </div>
                  </div>
                  {isOnline && (
                    <button
                      onClick={handleSync}
                      disabled={syncing}
                      className="px-8 py-4 rounded-xl font-bold text-white transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg"
                      style={{ 
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
                      }}
                    >
                      {syncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Main Content - Shows section content OR default charts based on activeSection */}
            {activeSection === 'overview' ? (
              <>
                {/* Active Users Indicator - Always on top in Overview */}
                <div className="mb-6 md:mb-8">
                  <ActiveUsersIndicator />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <div 
                    key={index} 
                    className="rounded-2xl shadow-lg p-6 bg-white border-4 border-yellow-500 hover:shadow-xl hover:scale-105 transition-all duration-300 transform"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div 
                        className="w-14 h-14 rounded-xl flex items-center justify-center shadow-md"
                        style={{ 
                          background: stat.color === 'bg-blue-500' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 
                                     stat.color === 'bg-green-500' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' :
                                     stat.color === 'bg-yellow-500' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' :
                                     'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
                        }}
                      >
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{stat.change}</span>
                    </div>
                    <div>
                      <p className="text-4xl font-bold mb-1 text-gray-800">{stat.value}</p>
                      <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
              {/* Enhanced Weekly Visits - Area Chart with Multiple Metrics */}
              <div 
                className="rounded-2xl shadow-lg p-6 bg-white border-4 border-yellow-500"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-800">Weekly Visits Trend</h3>
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-gray-600 font-medium">Visits</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-gray-600 font-medium">Unique Users</span>
                    </div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dailyVisits} barGap={8} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
                    <defs>
                      <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.9}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      </linearGradient>
                      <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.9}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.3}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis 
                      dataKey="day" 
                      stroke="#6b7280"
                      tick={{ fontSize: 12 }}
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
                        if (name === 'uniqueUsers') return [`${value} users`, 'Unique Users'];
                        return [value, name];
                      }}
                    />
                    <Bar 
                      dataKey="visits" 
                      fill="url(#colorVisits)" 
                      radius={[6, 6, 0, 0]}
                      maxBarSize={50}
                      name="visits"
                    />
                    <Bar 
                      dataKey="uniqueUsers" 
                      fill="url(#colorUsers)" 
                      radius={[6, 6, 0, 0]}
                      maxBarSize={50}
                      name="uniqueUsers"
                    />
                  </BarChart>
                </ResponsiveContainer>
                  <div className="mt-6 grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                    <div className="text-xl font-bold text-blue-700">
                      {isNaN(dailyVisits.reduce((sum: number, day: any) => sum + (day.visits || 0), 0)) ? 0 : dailyVisits.reduce((sum: number, day: any) => sum + (day.visits || 0), 0)}
                    </div>
                    <div className="text-blue-600 font-medium text-xs mt-1">Total Visits</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                    <div className="text-xl font-bold text-green-700">
                      {isNaN(dailyVisits.reduce((sum: number, day: any) => sum + (day.uniqueUsers || 0), 0)) ? 0 : dailyVisits.reduce((sum: number, day: any) => sum + (day.uniqueUsers || 0), 0)}
                    </div>
                    <div className="text-green-600 font-medium text-xs mt-1">Unique Users</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                    <div className="text-xl font-bold text-purple-700">
                      {dailyVisits.length > 0 ? (isNaN(Math.round(dailyVisits.reduce((sum: number, day: any) => sum + (day.averageDuration || 0), 0) / dailyVisits.length)) ? 0 : Math.round(dailyVisits.reduce((sum: number, day: any) => sum + (day.averageDuration || 0), 0) / dailyVisits.length)) : 0}m
                    </div>
                    <div className="text-purple-600 font-medium text-xs mt-1">Avg Duration</div>
                  </div>
                </div>
              </div>

              {/* Enhanced Peak Hours with Activity Zones */}
              <div 
                className="rounded-2xl shadow-lg p-6 bg-white border-4 border-yellow-500"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-800">Peak Hours Analysis</h3>
                  {peakHour?.hour && (
                    <div className="text-sm text-gray-600">
                      Peak: <span className="font-semibold text-yellow-600">{formatHour(peakHour.hour)}</span>
                      <span className="ml-2 text-gray-500">({peakHour.visits} visits)</span>
                    </div>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={peakHours} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
                    <defs>
                      <linearGradient id="colorPeakHours" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis 
                      dataKey="hour" 
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
                      formatter={(value: any) => [`${value} visits`, 'Visits']}
                      labelFormatter={(label) => `Time: ${label}`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#8b5cf6" 
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }}
                      activeDot={{ r: 8, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-6 grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                    <div className="text-xl font-bold text-purple-700">
                      {peakHour?.hour ? formatHour(peakHour.hour) : 'N/A'}
                    </div>
                    <div className="text-purple-600 font-medium text-xs mt-1">Peak Hour</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200">
                    <div className="text-xl font-bold text-yellow-700">
                      {peakHour?.visits || 0}
                    </div>
                    <div className="text-yellow-600 font-medium text-xs mt-1">Peak Visits</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl border border-indigo-200">
                    <div className="text-xl font-bold text-indigo-700">
                      {peakHours.length > 0 ? (isNaN(Math.max(...peakHours.map((h: any) => isNaN(h.count) ? 0 : h.count))) ? 0 : Math.max(...peakHours.map((h: any) => isNaN(h.count) ? 0 : h.count))) : 0}
                    </div>
                    <div className="text-indigo-600 font-medium text-xs mt-1">Max in Hour</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced User Type Distribution */}
            <div className="bg-white rounded-xl shadow-sm p-6 border-4 border-yellow-500 mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">User Type Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <RePieChart>
                  <Pie
                    data={userTypeData}
                    cx="50%"
                    cy="50%"
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
                    {userTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {userTypeData.map((item, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm text-gray-600">{item.name}: {String(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {/* Enhanced Engagement Metrics */}
              <div className="bg-white rounded-xl shadow-sm p-6 border-4 border-yellow-500">
                <h3 className="font-semibold text-gray-900 mb-4">Engagement Insights</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Target className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Repeat Visit Rate</span>
                    </div>
                    <span className="text-lg font-semibold text-blue-900">
                      {engagementMetrics?.repeatVisitRate || 0}%
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Timer className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-green-900">Avg Visit Duration</span>
                    </div>
                    <span className="text-lg font-semibold text-green-900">
                      {engagementMetrics?.averageVisitDuration || 0}m
                    </span>
                  </div>
                  
                  {engagementMetrics?.busiestTimeSlot && (
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <div className="text-sm font-medium text-purple-900 mb-2">Busiest Time Slot</div>
                      <div className="text-lg font-semibold text-purple-900">
                        {engagementMetrics.busiestTimeSlot.slot}
                      </div>
                      <div className="text-sm text-purple-600 mt-1">
                        {engagementMetrics.busiestTimeSlot.visits} visits
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                        {Object.entries(engagementMetrics.busiestTimeSlot.breakdown).map(([slot, count]: [string, any]) => (
                          <div key={slot} className="text-center">
                            <div className="text-purple-600">{slot}</div>
                            <div className="font-medium">{count}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-5 h-5 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-900">Avg Daily Visits</span>
                    </div>
                    <span className="text-lg font-semibold text-yellow-900">
                      {analytics?.averageDailyVisits || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            </>
            ) : (
              <div className="space-y-6">
                <div key={sectionKey} className="animate-slide-in">
                  {renderSectionContent()}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer - matching header style */}
      <footer 
        className="sticky bottom-0 z-50 shadow-lg border-t-4 border-yellow-500 min-h-[60px]"
        style={{
          background: '#111827'
        }}
      >
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        </div>
      </footer>
    </div>
  );
}
