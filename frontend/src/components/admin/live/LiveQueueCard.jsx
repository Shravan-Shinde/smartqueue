import React from 'react';
import { Users, Radio, Monitor, Layers, AlertCircle, PlayCircle, PauseCircle, StopCircle } from 'lucide-react';
import Badge from '../../common/Badge';

/**
 * Crowd level badge styling helper
 */
const getCrowdBadgeInfo = (level) => {
  switch (level) {
    case 'LOW':
      return { variant: 'success', label: 'LOW' };
    case 'MEDIUM':
      return { variant: 'info', label: 'MEDIUM' };
    case 'HIGH':
      return { variant: 'warning', label: 'HIGH' };
    case 'VERY HIGH':
      return { variant: 'danger', label: 'VERY HIGH' };
    default:
      return { variant: 'default', label: level || 'UNKNOWN' };
  }
};

/**
 * Queue Status badge styling helper
 */
const getQueueStatusInfo = (status) => {
  switch (status) {
    case 'OPEN':
      return { variant: 'success', label: 'OPEN', icon: PlayCircle };
    case 'PAUSED':
      return { variant: 'warning', label: 'PAUSED', icon: PauseCircle };
    case 'CLOSED':
      return { variant: 'danger', label: 'CLOSED', icon: StopCircle };
    default:
      return { variant: 'default', label: status || 'UNKNOWN', icon: StopCircle };
  }
};

/**
 * Individual Operational Live Queue Card Component
 */
const LiveQueueCard = ({ queue }) => {
  if (!queue) return null;

  const {
    queueName,
    prefix,
    status,
    waiting = 0,
    serving = 0,
    crowdLevel = 'LOW',
    activeCounters = 0,
    totalCounters = 0,
    maxCapacity = 0,
    capacityPercentage = 0,
    departmentName = '',
  } = queue;

  const crowdInfo = getCrowdBadgeInfo(crowdLevel);
  const statusInfo = getQueueStatusInfo(status);
  const StatusIcon = statusInfo.icon;

  const isHighCrowd = crowdLevel === 'HIGH' || crowdLevel === 'VERY HIGH';

  return (
    <div
      className={`bg-sq-surface rounded-2xl p-5 border transition-all duration-300 space-y-4 shadow-lg ${
        crowdLevel === 'VERY HIGH'
          ? 'border-red-500/50 shadow-red-500/10 ring-1 ring-red-500/20'
          : crowdLevel === 'HIGH'
          ? 'border-amber-500/40 shadow-amber-500/10'
          : 'border-sq-border hover:border-sq-border'
      }`}
    >
      {/* Header: Queue Name & Status Badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sq-surfaceSecondary text-sq-info flex items-center justify-center font-mono font-black text-sm border border-sq-border">
            {prefix || 'Q'}
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-sq-textPrimary leading-tight line-clamp-1">{queueName}</h4>
            {departmentName && (
              <span className="text-[11px] text-sq-textSecondary font-medium block mt-0.5">{departmentName}</span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <Badge variant={statusInfo.variant} size="sm">
            <span className="flex items-center gap-1">
              <StatusIcon className="w-3 h-3" />
              {statusInfo.label}
            </span>
          </Badge>

          <Badge variant={crowdInfo.variant} size="sm" dot>
            {crowdInfo.label}
          </Badge>
        </div>
      </div>

      {/* Live Operational Numbers: Waiting vs Serving */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="bg-sq-surfaceSecondary p-3 rounded-xl border border-sq-border text-center">
          <span className="text-[10px] font-extrabold text-sq-muted uppercase block">Waiting</span>
          <div className="text-2xl font-black text-sq-primary mt-0.5">{waiting}</div>
          <span className="text-[10px] text-sq-textSecondary">customers</span>
        </div>

        <div className="bg-sq-surfaceSecondary p-3 rounded-xl border border-sq-border text-center">
          <span className="text-[10px] font-extrabold text-sq-muted uppercase block">Serving</span>
          <div className="text-2xl font-black text-sq-info mt-0.5">{serving}</div>
          <span className="text-[10px] text-sq-textSecondary">at counters</span>
        </div>
      </div>

      {/* Counter Capacity & Queue Max Capacity */}
      <div className="space-y-2 pt-2 border-t border-sq-border">
        {/* Active Counters Info */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-sq-textSecondary font-medium flex items-center gap-1.5">
            <Monitor className="w-3.5 h-3.5 text-sq-info" />
            Active Service Capacity:
          </span>
          <span className="font-extrabold text-sq-textPrimary">
            {activeCounters} / {totalCounters} Counters
          </span>
        </div>

        {/* Max Capacity Progress Bar */}
        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-sq-muted font-semibold">
              Queue Capacity {maxCapacity > 0 ? `(${waiting} / ${maxCapacity})` : '(Unlimited)'}
            </span>
            {maxCapacity > 0 && (
              <span
                className={`font-mono font-bold ${
                  capacityPercentage >= 90
                    ? 'text-red-400'
                    : capacityPercentage >= 70
                    ? 'text-amber-400'
                    : 'text-sq-textSecondary'
                }`}
              >
                {capacityPercentage}%
              </span>
            )}
          </div>

          {maxCapacity > 0 && (
            <div className="w-full h-2 bg-sq-surfaceSecondary rounded-full overflow-hidden border border-sq-border">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  capacityPercentage >= 90
                    ? 'bg-red-500'
                    : capacityPercentage >= 70
                    ? 'bg-amber-400'
                    : 'bg-sq-primary'
                }`}
                style={{ width: `${Math.min(100, capacityPercentage)}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveQueueCard;
