import React from 'react';
import { Users, CheckCircle2, Clock, Wrench, AlertTriangle, UserX, Activity, Radio } from 'lucide-react';
import StatCard from '../../common/StatCard';

/**
 * Overview Metrics Section displaying historical KPIs and live operational state
 */
const AnalyticsOverviewSection = ({ data }) => {
  if (!data) return null;

  const {
    totalVisitors = 0,
    totalEntries = 0,
    completed = 0,
    cancelled = 0,
    noShow = 0,
    currentlyWaiting = 0,
    currentlyServing = 0,
    averageWaitMinutes = 0,
    averageServiceMinutes = 0,
    completionRate = 0,
    cancellationRate = 0,
    noShowRate = 0,
  } = data;

  return (
    <div className="space-y-6">
      {/* Live Operational State Banner */}
      <div className="bg-gradient-to-r from-[#282936] to-[#21222D] p-5 rounded-2xl border border-sq-border shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-sq-textPrimary">
                Live Queue State
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <p className="text-[11px] text-sq-textSecondary mt-0.5">
              Real-time active queue metrics (Unfiltered by date range)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 self-end md:self-auto">
          <div className="flex items-center gap-3 bg-sq-surfaceSecondary px-4 py-2.5 rounded-xl border border-sq-border">
            <span className="text-xs text-sq-textSecondary font-semibold">Currently Waiting:</span>
            <span className="text-xl font-black text-sq-primary">{currentlyWaiting}</span>
          </div>

          <div className="flex items-center gap-3 bg-sq-surfaceSecondary px-4 py-2.5 rounded-xl border border-sq-border">
            <span className="text-xs text-sq-textSecondary font-semibold">Currently Serving:</span>
            <span className="text-xl font-black text-sq-info">{currentlyServing}</span>
          </div>
        </div>
      </div>

      {/* Historical Metrics KPI Grid */}
      <div>
        <h3 className="text-xs font-extrabold text-sq-muted uppercase tracking-wider mb-4">
          Historical Overview Metrics (Selected Period)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Visitors / Entries */}
          <StatCard
            title="Total Visitors"
            value={totalVisitors.toLocaleString()}
            subtitle={`${totalEntries.toLocaleString()} total ticket entries`}
            icon={Users}
            accentColor="lavender"
          />

          {/* Completed Services */}
          <StatCard
            title="Completed Services"
            value={completed.toLocaleString()}
            subtitle={`${completionRate}% completion rate`}
            icon={CheckCircle2}
            accentColor="emerald"
          />

          {/* Average Wait Time */}
          <StatCard
            title="Average Wait Time"
            value={`${averageWaitMinutes} min`}
            subtitle="Actual wait before called"
            icon={Clock}
            accentColor="pink"
          />

          {/* Average Service Duration */}
          <StatCard
            title="Average Service Time"
            value={`${averageServiceMinutes} min`}
            subtitle="Actual service duration"
            icon={Wrench}
            accentColor="purple"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          {/* Completion Rate */}
          <div className="bg-sq-surface border border-sq-border rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-sq-muted uppercase">Completion Rate</span>
              <div className="text-2xl font-black text-emerald-400 mt-1">{completionRate}%</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          {/* Cancellation Rate */}
          <div className="bg-sq-surface border border-sq-border rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-sq-muted uppercase">Cancellation Rate</span>
              <div className="text-2xl font-black text-amber-400 mt-1">{cancellationRate}%</div>
              <span className="text-[10px] text-sq-muted">{cancelled} entries cancelled</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          {/* No-Show Rate */}
          <div className="bg-sq-surface border border-sq-border rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-sq-muted uppercase">No-Show Rate</span>
              <div className="text-2xl font-black text-red-400 mt-1">{noShowRate}%</div>
              <span className="text-[10px] text-sq-muted">{noShow} entries no-show</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center font-bold text-xs">
              <UserX className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsOverviewSection;
