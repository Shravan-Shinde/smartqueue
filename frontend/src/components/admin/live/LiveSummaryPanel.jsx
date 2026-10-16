import React from 'react';
import { Users, Radio, PlayCircle, PauseCircle, AlertTriangle, AlertOctagon } from 'lucide-react';

/**
 * Live Operational Summary KPI Panel
 */
const LiveSummaryPanel = ({ summary }) => {
  if (!summary) return null;

  const {
    totalWaiting = 0,
    totalServing = 0,
    openQueues = 0,
    pausedQueues = 0,
    highCrowdQueues = 0,
    veryHighCrowdQueues = 0,
    totalQueues = 0,
  } = summary;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {/* Total Waiting */}
      <div className="bg-sq-surface p-4 rounded-2xl border border-sq-border shadow-md flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-sq-muted">Total Waiting</span>
          <div className="text-2xl font-black text-sq-primary mt-0.5">{totalWaiting}</div>
          <span className="text-[10px] text-sq-muted">Across {totalQueues} queues</span>
        </div>
        <div className="w-9 h-9 rounded-xl bg-sq-primarySubtle text-sq-primary flex items-center justify-center font-bold">
          <Users className="w-4 h-4" />
        </div>
      </div>

      {/* Currently Serving */}
      <div className="bg-sq-surface p-4 rounded-2xl border border-sq-border shadow-md flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-sq-muted">Currently Serving</span>
          <div className="text-2xl font-black text-sq-info mt-0.5">{totalServing}</div>
          <span className="text-[10px] text-sq-muted">At active counters</span>
        </div>
        <div className="w-9 h-9 rounded-xl bg-sq-infoBg text-sq-info flex items-center justify-center font-bold">
          <Radio className="w-4 h-4" />
        </div>
      </div>

      {/* Open Queues */}
      <div className="bg-sq-surface p-4 rounded-2xl border border-sq-border shadow-md flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-sq-muted">Open Queues</span>
          <div className="text-2xl font-black text-emerald-400 mt-0.5">{openQueues}</div>
          <span className="text-[10px] text-sq-muted">Accepting tickets</span>
        </div>
        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">
          <PlayCircle className="w-4 h-4" />
        </div>
      </div>

      {/* Paused Queues */}
      <div className="bg-sq-surface p-4 rounded-2xl border border-sq-border shadow-md flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-sq-muted">Paused Queues</span>
          <div className="text-2xl font-black text-amber-400 mt-0.5">{pausedQueues}</div>
          <span className="text-[10px] text-sq-muted">Temporarily hold</span>
        </div>
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
          <PauseCircle className="w-4 h-4" />
        </div>
      </div>

      {/* High Crowd Queues */}
      <div className="bg-sq-surface p-4 rounded-2xl border border-sq-border shadow-md flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-sq-muted">High Crowd</span>
          <div className="text-2xl font-black text-amber-400 mt-0.5">{highCrowdQueues}</div>
          <span className="text-[10px] text-sq-muted">31–60 waiting</span>
        </div>
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
          <AlertTriangle className="w-4 h-4" />
        </div>
      </div>

      {/* Very High Crowd Queues */}
      <div className="bg-sq-surface p-4 rounded-2xl border border-sq-border shadow-md flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-sq-muted">Very High Crowd</span>
          <div className="text-2xl font-black text-red-400 mt-0.5">{veryHighCrowdQueues}</div>
          <span className="text-[10px] text-sq-muted">61+ waiting</span>
        </div>
        <div className="w-9 h-9 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center font-bold">
          <AlertOctagon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};

export default LiveSummaryPanel;
