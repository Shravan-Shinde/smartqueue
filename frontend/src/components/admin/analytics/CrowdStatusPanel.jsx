import React from 'react';
import { Activity, Users, Layers, AlertTriangle } from 'lucide-react';
import Badge from '../../common/Badge';
import EmptyState from '../../common/EmptyState';

/**
 * Crowd level badge helper
 */
const getCrowdBadgeVariant = (level) => {
  switch (level) {
    case 'LOW':
      return { variant: 'success', text: 'LOW (0–10)' };
    case 'MEDIUM':
      return { variant: 'info', text: 'MEDIUM (11–30)' };
    case 'HIGH':
      return { variant: 'warning', text: 'HIGH (31–60)' };
    case 'VERY HIGH':
      return { variant: 'danger', text: 'VERY HIGH (61+)' };
    default:
      return { variant: 'default', text: level || 'UNKNOWN' };
  }
};

/**
 * Crowd Status Panel Component
 */
const CrowdStatusPanel = ({ data }) => {
  if (!data) return null;

  const {
    currentWaitingCount = 0,
    crowdStatus = 'LOW',
    queues = [],
  } = data;

  const overallBadge = getCrowdBadgeVariant(crowdStatus);

  return (
    <div className="bg-sq-surface p-5 rounded-2xl border border-sq-border shadow-lg space-y-5">
      {/* Crowd Header & Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sq-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sq-warningBg text-sq-textSecondary border border-sq-warning">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-sq-textPrimary">
                Live Crowd Monitoring
              </h3>
              <span className="w-2 h-2 rounded-full bg-sq-warning animate-ping" />
            </div>
            <p className="text-xs text-sq-textSecondary mt-0.5">
              Live customer waiting depth & crowd level classification across operational queues
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-sq-surfaceSecondary p-3 rounded-xl border border-sq-border self-start sm:self-auto">
          <div>
            <span className="text-[10px] uppercase font-bold text-sq-muted block">Overall System Crowd</span>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant={overallBadge.variant} size="md" dot>
                {crowdStatus}
              </Badge>
              <span className="text-xs font-bold text-sq-textPrimary">
                {currentWaitingCount} waiting
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Per-Queue Crowd Grid Cards */}
      {queues.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No Active Queues"
          description="There are currently no active queues monitored for crowd level."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {queues.map((q) => {
            const queueBadge = getCrowdBadgeVariant(q.crowdLevel);
            return (
              <div
                key={q.queueId}
                className="bg-sq-surfaceSecondary p-4 rounded-xl border border-sq-border hover:border-sq-border transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-sq-surfaceSecondary text-sq-textSecondary border border-sq-warning flex items-center justify-center font-mono font-bold text-xs">
                      {q.prefix || 'Q'}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-sq-textPrimary">{q.queueName}</h4>
                      <span className="text-[10px] text-sq-muted">Cap: {q.maxCapacity || 'Unlimited'}</span>
                    </div>
                  </div>

                  <Badge variant={queueBadge.variant} size="sm" dot>
                    {q.crowdLevel}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-sq-border text-center">
                  <div className="bg-sq-surface p-2 rounded-lg border border-sq-border">
                    <span className="text-[10px] text-sq-muted uppercase font-bold block">Waiting</span>
                    <span className="text-base font-black text-sq-textSecondary">{q.waitingCount}</span>
                  </div>

                  <div className="bg-sq-surface p-2 rounded-lg border border-sq-border">
                    <span className="text-[10px] text-sq-muted uppercase font-bold block">Serving</span>
                    <span className="text-base font-black text-sq-textSecondary">{q.servingCount}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CrowdStatusPanel;
