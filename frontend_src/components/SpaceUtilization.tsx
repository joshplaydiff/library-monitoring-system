import React from 'react';
import { Gauge, History } from 'lucide-react';
import { AnalyticsTooltip, ANALYTICS_DESCRIPTIONS } from './AnalyticsTooltip';

interface SpaceUtilizationProps {
  analytics: any;
}

// Helper function to calculate capacity status
const calculateCapacityStatus = (current: number, max: number) => {
  const percentage = max > 0 ? (current / max) * 100 : 0;
  if (percentage >= 90) return { status: 'critical', color: '#ef4444', label: 'Critical' };
  if (percentage >= 80) return { status: 'warning', color: '#f59e0b', label: 'Warning' };
  return { status: 'normal', color: '#10b981', label: 'Normal' };
};

export function SpaceUtilization({ analytics }: SpaceUtilizationProps) {
  const currentOccupancy = analytics?.currentlyInside || 0;
  const maxCapacity = analytics?.maxCapacity || 150;
  const capacityPercentage = maxCapacity > 0 ? (currentOccupancy / maxCapacity) * 100 : 0;
  const capacityStatus = calculateCapacityStatus(currentOccupancy, maxCapacity);
  const totalVisits = analytics?.totalVisits || 0;
  const target = analytics?.target || 10000;
  const progressToTarget = target > 0 ? (totalVisits / target) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Capacity Alerts Gauge */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2">
            <Gauge className="w-6 h-6" style={{ color: capacityStatus.color }} />
            <span>Capacity Alerts</span>
            <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.capacityAlerts.description} />
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
      <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-yellow-500">
        <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-4">
          <History className="w-6 h-6 text-purple-500" />
          <span>Benchmarking (Year-over-Year)</span>
          <AnalyticsTooltip description={ANALYTICS_DESCRIPTIONS.benchmarking.description} />
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
}