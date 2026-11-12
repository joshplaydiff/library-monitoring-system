import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

interface AnalyticsTooltipProps {
  description: string;
  className?: string;
}

export function AnalyticsTooltip({ description, className }: AnalyticsTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className={`w-4 h-4 text-gray-400 cursor-help hover:text-gray-600 inline-block ml-1 ${className}`} />
      </TooltipTrigger>
      <TooltipContent 
        side="top" 
        className="max-w-xs bg-gray-900 text-white text-sm p-3 rounded-lg shadow-lg"
        style={{ backgroundColor: '#1f2937' }}
      >
        <p className="leading-relaxed">{description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export const ANALYTICS_DESCRIPTIONS = {
  visitLogs: {
    title: "Visit Logs Records",
    description: "Comprehensive log of all library visits including entry and exit times, user details, departments, and visit purposes. Use filters to search and export data for reporting."
  },
  activeUsers: {
    title: "Currently Active Users",
    description: "Real-time display of users currently inside the library. Shows entry time, duration, purpose, and allows manual checkout if needed."
  },
  realTimeOccupancy: {
    title: "Real-time Occupancy",
    description: "Current number of users inside the library compared to maximum capacity. Critical for ensuring safety and optimal resource allocation."
  },
  averageDwellTime: {
    title: "Average Dwell Time",
    description: "Average time visitors spend in the library. Helps in understanding usage patterns and planning facility resources."
  },
  peakTrafficHours: {
    title: "Peak Traffic Hours",
    description: "Hours with highest visitor activity. Essential for staffing decisions and resource allocation during busy periods."
  },
  busiestDays: {
    title: "Busiest Days of the Week",
    description: "Weekly pattern of visitor traffic. Use this to optimize opening hours and schedule maintenance."
  },
  avgDurationByDepartment: {
    title: "Average Visit Duration by Department",
    description: "Shows how long users from each department typically stay. Useful for understanding department-specific needs."
  },
  departmentGrowthTrends: {
    title: "Department Growth Trends",
    description: "Week-over-week comparison of visits by department. Identifies which departments are increasing or decreasing library usage."
  },
  visitsByDepartment: {
    title: "Visits by Department with Peak Hours",
    description: "Total visits and peak hours for each department. The hourly grid shows busy times throughout the day."
  },
  avgDurationByTimeOfDay: {
    title: "Average Duration by Time of Day",
    description: "How visit duration varies throughout the day. Helps optimize staffing based on when users stay longest."
  },
  avgDurationByDayOfWeek: {
    title: "Average Duration by Day of Week",
    description: "Which days have the longest average visits. Important for resource planning and service optimization."
  },
  durationTrends: {
    title: "Visit Duration Trends",
    description: "Track how average visit duration changes over time. Identify seasonal patterns and long-term changes."
  },
  shortVsLongVisits: {
    title: "Short vs Long Visits Distribution",
    description: "Breakdown of visits by length - short (<30min), medium (30-60min), long (>60min). Understand user behavior patterns."
  },
  popularPurposes: {
    title: "Most Popular Purposes Ranking",
    description: "Top reasons users visit the library ranked by frequency. Helps understand and cater to user needs."
  },
  purposeTrends: {
    title: "Purpose Trends Over Time",
    description: "Track how different visit purposes change over time. Identify emerging needs and declining activities."
  },
  purposeByUserType: {
    title: "Purpose by User Type",
    description: "What each user type (student, faculty, staff) primarily uses the library for. Tailor services accordingly."
  },
  purposeByDepartment: {
    title: "Purpose by Department",
    description: "Most common visit purposes for each department. Understand departmental library usage patterns."
  },
  capacityAlerts: {
    title: "Capacity Alerts",
    description: "Current occupancy status with warning thresholds. Critical for safety compliance and crowd management."
  },
  benchmarking: {
    title: "Benchmarking (Year-over-Year)",
    description: "Compare current year performance against targets and previous years. Track progress towards goals."
  },
  historicalComparison: {
    title: "Historical Comparison",
    description: "Compare current period metrics with previous period. Understand trends and seasonal variations."
  },
  longTermTrends: {
    title: "Long-Term Trends",
    description: "12-period view of visits and users over time. Identify long-term growth patterns and seasonality."
  },
  currentStatus: {
    title: "Current Capacity Status",
    description: "Real-time view of current occupancy, utilization percentage, and status message. Critical for operations."
  },
  historicalUtilization: {
    title: "Historical Capacity Utilization",
    description: "Past capacity usage patterns. Helps plan for expected demand and identify unusual periods."
  },
  peakTimes: {
    title: "Peak Times Analysis",
    description: "When the library is busiest by hour and day. Schedule staff and resources accordingly."
  },
  capacityForecast: {
    title: "Capacity Forecast",
    description: "Predicted utilization for the next 7 days. Plan ahead for expected demand with confidence levels."
  },
  avgSessionDurationByUserType: {
    title: "Session Duration by User Type",
    description: "Average time spent by each user category. Understand different user behavior patterns."
  },
  peakUsageByDepartment: {
    title: "Peak Usage by Department",
    description: "When each department uses the library most. Coordinate departmental activities effectively."
  },
  topPurposesByUserType: {
    title: "Top Purposes by User Type",
    description: "Primary reasons each user type visits. Customize services for different user groups."
  },
  userRetention: {
    title: "User Retention Rate",
    description: "Percentage of users who return. Higher retention indicates user satisfaction and library value."
  },
  firstTimeVsReturning: {
    title: "First-time vs Returning Visitors",
    description: "Ratio of new to returning visitors. New visitors need orientation; returning visitors need consistent service."
  },
  engagementScores: {
    title: "Engagement Score Distribution",
    description: "How users are distributed across engagement levels - Power Users (80+), Active (50-79), Low Engagement (<50)."
  },
  powerUsers: {
    title: "Power Users (Top 20%)",
    description: "Most engaged users with scores 80+. Identify your most valuable users for retention efforts."
  },
  atRiskUsers: {
    title: "At-Risk Users",
    description: "Users inactive for 14+ days. Prioritize re-engagement campaigns to bring them back."
  },
  lifetimeValue: {
    title: "User Lifetime Value",
    description: "Projected value of users based on visit frequency and duration. Focus retention efforts on high-value users."
  },
  syncStatus: {
    title: "Sync Status",
    description: "Connection status and pending logs queue. Ensure data is properly synchronized with the server."
  },
  dataIntegrity: {
    title: "Data Integrity Check",
    description: "Number of incomplete logs (checked in but not out). Critical for accurate analytics and reporting."
  },
  departmentDistribution: {
    title: "Department Distribution",
    description: "Breakdown of visits by department. Understand which departments use the library most."
  },
  repeatVsUnique: {
    title: "Repeat vs Unique Visitors",
    description: "Percentage of first-time vs returning visitors. High repeat rate indicates loyal user base."
  }
};