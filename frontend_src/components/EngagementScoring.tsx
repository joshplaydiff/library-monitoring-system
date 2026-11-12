import React, { useState, useEffect, useMemo } from 'react';
import { useIsMobile } from './ui/use-mobile';
import { 
  TrendingUp, 
  TrendingDown, 
  Users,
  Zap,
  AlertTriangle,
  Clock,
  Target,
  Star,
  UserCheck,
  UserX,
  DollarSign,
  RefreshCw,
  Award,
  Heart
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
import { getEngagementAnalytics } from '../utils/api';
import { AnalyticsTooltip, ANALYTICS_DESCRIPTIONS } from './AnalyticsTooltip';

interface EngagementScoringProps {
  analytics: any;
  loading: boolean;
}

type ViewTab = 'overview' | 'power-users' | 'at-risk' | 'ltv';

interface UserScore {
  userId: string;
  name: string;
  userType: string;
  department: string;
  totalVisits: number;
  avgDuration: number;
  firstVisit: string;
  lastVisit: string;
  daysSinceLastVisit: number;
  scores: {
    visitFrequency: number;
    duration: number;
    recency: number;
    overall: number;
  };
  status: string;
}

interface EngagementData {
  userScores: UserScore[];
  powerUsers: UserScore[];
  atRiskUsers: (UserScore & { riskLevel: string; trend: string })[];
  ltv: {
    userId: string;
    name: string;
    totalVisits: number;
    avgDuration: number;
    daysActive: number;
    projectedVisitsPerMonth: number;
    ltvScore: number;
    valueTier: string;
  }[];
  summary: {
    totalUsers: number;
    avgEngagementScore: number;
    powerUserCount: number;
    atRiskCount: number;
    avgVisitsPerUser: number;
    avgDurationMinutes: number;
  };
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function EngagementScoring({ analytics, loading: parentLoading }: EngagementScoringProps) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<ViewTab>('overview');
  const [engagementData, setEngagementData] = useState<EngagementData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minVisits, setMinVisits] = useState(2);
  const [daysBack, setDaysBack] = useState(30);

  // Fetch engagement data
  useEffect(() => {
    loadEngagementData();
  }, [minVisits, daysBack]);

  const loadEngagementData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getEngagementAnalytics(minVisits, daysBack);
      if (result.success && result.data) {
        setEngagementData(result.data);
      } else {
        setError(result.error || 'Failed to load engagement data');
      }
    } catch (err) {
      setError('Error loading engagement analytics');
      console.error('Engagement analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981'; // green
    if (score >= 50) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Power User';
    if (score >= 50) return 'Active';
    return 'Low Engagement';
  };

  // Summary Cards - Each in its own card with yellow outline
  const renderSummaryCards = () => {
    if (!engagementData?.summary) return null;
    const summary = engagementData.summary;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Users Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Users</p>
              <p className="text-3xl font-bold text-blue-600">{summary.totalUsers}</p>
            </div>
            <Users className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        {/* Avg Engagement Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg Engagement</p>
              <p className="text-3xl font-bold text-purple-600">{summary.avgEngagementScore}</p>
              <p className="text-xs text-gray-400">out of 100</p>
            </div>
            <Zap className="w-10 h-10 text-purple-500" />
          </div>
        </div>

        {/* Power Users Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Power Users</p>
              <p className="text-3xl font-bold text-green-600">{summary.powerUserCount}</p>
              <p className="text-xs text-gray-400">top 20%</p>
            </div>
            <Star className="w-10 h-10 text-green-500" />
          </div>
        </div>

        {/* At Risk Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">At Risk</p>
              <p className="text-3xl font-bold text-red-600">{summary.atRiskCount}</p>
              <p className="text-xs text-gray-400">14+ days inactive</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
        </div>
      </div>
    );
  };

  // Engagement score distribution chart
  const renderEngagementDistribution = () => {
    if (!engagementData?.userScores) return null;

    const scoreRanges = [
      { range: '80-100', label: 'Power Users', count: 0, color: '#10b981' },
      { range: '50-79', label: 'Active', count: 0, color: '#f59e0b' },
      { range: '0-49', label: 'Low Engagement', count: 0, color: '#ef4444' }
    ];

    engagementData.userScores.forEach(user => {
      const score = user.scores.overall;
      if (score >= 80) scoreRanges[0].count++;
      else if (score >= 50) scoreRanges[1].count++;
      else scoreRanges[2].count++;
    });

    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-500" />
          Engagement Score Distribution
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.engagementScores.description} />
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={scoreRanges}
              dataKey="count"
              nameKey="label"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ label, count }) => `${label}: ${count}`}
            >
              {scoreRanges.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // Tab navigation
  const renderTabs = () => {
    const tabs = [
      { id: 'overview', label: 'Overview', icon: Target },
      { id: 'power-users', label: 'Power Users', icon: Star },
      { id: 'at-risk', label: 'At Risk Users', icon: AlertTriangle },
      { id: 'ltv', label: 'Lifetime Value', icon: DollarSign },
    ] as const;

    return (
      <div className="md:col-span-2 flex gap-2 overflow-x-auto p-4 bg-white rounded-2xl shadow-lg border-4 border-yellow-500">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-yellow-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>
    );
  };

  // Overview tab content
  const renderOverviewTab = () => {
    if (!engagementData?.userScores) return null;

    // Top users by engagement
    const topUsers = engagementData.userScores.slice(0, 10).map(user => ({
      name: user.name,
      score: user.scores.overall,
      visits: user.totalVisits,
      status: user.status
    }));

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Users Chart */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-500" />
            Top 10 Users by Engagement
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topUsers} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value: number) => [`${value}`, 'Score']} />
              <Bar dataKey="score" name="Engagement Score" radius={[0, 4, 4, 0]}>
                {topUsers.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getScoreColor(entry.score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Score breakdown */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-500" />
            Score Breakdown
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Visit Frequency (40%)</span>
                <span className="text-sm text-gray-600">
                  {engagementData.summary.avgVisitsPerUser} avg visits
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '60%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Duration (40%)</span>
                <span className="text-sm text-gray-600">
                  {engagementData.summary.avgDurationMinutes} min avg
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '50%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Recency (20%)</span>
                <span className="text-sm text-gray-600">Last 30 days</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: '70%' }}></div>
              </div>
            </div>
          </div>
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold mb-2">Engagement Score Formula</h4>
            <p className="text-sm text-gray-600">
              Score = (Visit Frequency × 0.4) + (Duration × 0.4) + (Recency × 0.2)
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Power Users tab
  const renderPowerUsersTab = () => {
    if (!engagementData?.powerUsers) return null;

    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          Power Users (Top 20%)
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.powerUsers.description} />
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Department</th>
                <th className="px-4 py-3 text-center font-medium">Visits</th>
                <th className="px-4 py-3 text-center font-medium">Avg Duration</th>
                <th className="px-4 py-3 text-center font-medium">Score</th>
                <th className="px-4 py-3 text-center font-medium">Last Visit</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {engagementData.powerUsers.map((user, index) => (
                <tr key={user.userId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span className="font-medium">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize">{user.userType}</td>
                  <td className="px-4 py-3">{user.department}</td>
                  <td className="px-4 py-3 text-center">{user.totalVisits}</td>
                  <td className="px-4 py-3 text-center">{user.avgDuration} min</td>
                  <td className="px-4 py-3 text-center">
                    <span 
                      className="px-2 py-1 rounded-full text-white text-xs font-medium"
                      style={{ backgroundColor: getScoreColor(user.scores.overall) }}
                    >
                      {user.scores.overall}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {user.daysSinceLastVisit === 0 ? 'Today' : `${user.daysSinceLastVisit}d ago`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // At-Risk Users tab
  const renderAtRiskTab = () => {
    if (!engagementData?.atRiskUsers) return null;

    if (engagementData.atRiskUsers.length === 0) {
      return (
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center border-4 border-yellow-500">
          <UserCheck className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No At-Risk Users</h3>
          <p className="text-gray-500">All users have visited within the last 14 days.</p>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          At-Risk Users (Inactive 14+ Days)
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.atRiskUsers.description} />
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-center font-medium">Total Visits</th>
                <th className="px-4 py-3 text-center font-medium">Days Inactive</th>
                <th className="px-4 py-3 text-center font-medium">Risk Level</th>
                <th className="px-4 py-3 text-center font-medium">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {engagementData.atRiskUsers.map((user) => (
                <tr key={user.userId} className="bg-red-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <UserX className="w-4 h-4 text-red-500" />
                      <span className="font-medium">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize">{user.userType}</td>
                  <td className="px-4 py-3 text-center">{user.totalVisits}</td>
                  <td className="px-4 py-3 text-center font-medium text-red-600">
                    {user.daysSinceLastVisit} days
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span 
                      className={`px-2 py-1 rounded-full text-white text-xs font-medium ${
                        user.riskLevel === 'high' ? 'bg-red-500' : 'bg-yellow-500'
                      }`}
                    >
                      {user.riskLevel.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {user.trend === 'declining' ? (
                      <div className="flex items-center justify-center gap-1 text-red-600">
                        <TrendingDown className="w-4 h-4" />
                        Declining
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1 text-yellow-600">
                        <Clock className="w-4 h-4" />
                        Inactive
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Lifetime Value tab
  const renderLtvTab = () => {
    if (!engagementData?.ltv) return null;

    const topLtv = engagementData.ltv.slice(0, 15);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LTV Distribution */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-500" />
            User Lifetime Value - Top 15
            <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.lifetimeValue.description} />
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topLtv} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value: number) => [`${value}`, 'LTV Score']} />
              <Bar dataKey="ltvScore" name="LTV Score" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* LTV Table */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-500" />
            Value Tier Breakdown
          </h3>
          <div className="space-y-3">
            {['High Value', 'Medium Value', 'Low Value'].map(tier => {
              const tierUsers = engagementData.ltv.filter(u => u.valueTier === tier);
              return (
                <div key={tier} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{tier}</span>
                    <span className="text-2xl font-bold text-gray-700">{tierUsers.length}</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {tierUsers.length > 0 
                      ? `Avg LTV: ${isNaN(Math.round(tierUsers.reduce((sum, u) => sum + (isNaN(u.ltvScore) ? 0 : u.ltvScore), 0) / tierUsers.length)) ? 0 : Math.round(tierUsers.reduce((sum, u) => sum + (isNaN(u.ltvScore) ? 0 : u.ltvScore), 0) / tierUsers.length)}`
                      : 'No users'
                    }
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            <h4 className="font-semibold mb-2 text-green-700">LTV Formula</h4>
            <p className="text-sm text-green-600">
              LTV = Total Visits × Avg Duration (minutes) / 60 × 10
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Filters
  const renderFilters = () => {
    return (
      <div className="md:col-span-2 flex flex-wrap gap-4 p-4 bg-white rounded-2xl shadow-lg border-4 border-yellow-500">
        <div className="flex items-center gap-2">
          <label htmlFor="min-visits-filter" className="text-sm text-gray-600 font-medium">Min Visits:</label>
          <select
            id="min-visits-filter"
            name="minVisits"
            value={minVisits}
            onChange={(e) => setMinVisits(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value={1}>1+ visits</option>
            <option value={2}>2+ visits</option>
            <option value={3}>3+ visits</option>
            <option value={5}>5+ visits</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="lookback-filter" className="text-sm text-gray-600 font-medium">Lookback:</label>
          <select
            id="lookback-filter"
            name="lookback"
            value={daysBack}
            onChange={(e) => setDaysBack(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
      </div>
    );
  };

  if (loading && !engagementData) {
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
        <div className="md:col-span-2 bg-white rounded-2xl shadow-lg p-4 border-4 border-red-500 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {renderFilters()}
      
      {renderSummaryCards()}
      
      {renderTabs()}

      {activeTab === 'overview' && (
        <>
          {renderEngagementDistribution()}
          {renderOverviewTab()}
        </>
      )}
      {activeTab === 'power-users' && renderPowerUsersTab()}
      {activeTab === 'at-risk' && renderAtRiskTab()}
      {activeTab === 'ltv' && renderLtvTab()}
    </div>
  );
}
