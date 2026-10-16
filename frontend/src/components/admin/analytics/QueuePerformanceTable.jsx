import React, { useState } from 'react';
import { Layers, Search, Clock, CheckCircle2, AlertTriangle, Users } from 'lucide-react';
import Badge from '../../common/Badge';
import EmptyState from '../../common/EmptyState';

/**
 * Crowd level badge helper with accessible text and dot indicator
 */
const getCrowdBadgeVariant = (level) => {
  switch (level) {
    case 'LOW':
      return { variant: 'success', text: 'LOW' };
    case 'MEDIUM':
      return { variant: 'info', text: 'MEDIUM' };
    case 'HIGH':
      return { variant: 'warning', text: 'HIGH' };
    case 'VERY HIGH':
      return { variant: 'danger', text: 'VERY HIGH' };
    default:
      return { variant: 'default', text: level || 'UNKNOWN' };
  }
};

/**
 * Queue Performance Table Component
 */
const QueuePerformanceTable = ({ data = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredQueues = data.filter((q) =>
    q.queueName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.prefix?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-sq-surface p-5 rounded-2xl border border-sq-border shadow-lg space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-sq-textPrimary flex items-center gap-2">
            <Layers className="w-5 h-5 text-sq-primary" />
            Queue Performance Breakdown
          </h3>
          <p className="text-xs text-sq-textSecondary mt-0.5">
            Detailed status totals, actual wait/service times, and live crowd status per queue
          </p>
        </div>

        {data.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-sq-muted" />
            <input
              type="text"
              placeholder="Search queue name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-sq-surfaceSecondary text-xs text-sq-textPrimary placeholder-sq-muted rounded-xl pl-9 pr-3 py-1.5 border border-sq-border focus:outline-none focus:border-sq-primary"
            />
          </div>
        )}
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No Queue Metrics Available"
          description="There are no queue records matching the selected filter criteria."
        />
      ) : filteredQueues.length === 0 ? (
        <p className="text-xs text-sq-muted py-6 text-center">No queues match your search query.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-sq-border text-sq-muted uppercase text-[10px]">
                <th className="pb-3 font-bold">Queue</th>
                <th className="pb-3 font-bold text-center">Total</th>
                <th className="pb-3 font-bold text-center">Completed</th>
                <th className="pb-3 font-bold text-center">Avg Wait</th>
                <th className="pb-3 font-bold text-center">Avg Service</th>
                <th className="pb-3 font-bold text-center">Cancel %</th>
                <th className="pb-3 font-bold text-center">No-Show %</th>
                <th className="pb-3 font-bold text-center">Live Waiting</th>
                <th className="pb-3 font-bold text-right">Live Crowd</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredQueues.map((q) => {
                const crowd = getCrowdBadgeVariant(q.crowdLevel);
                return (
                  <tr key={q.queueId} className="hover:bg-white/5 transition-colors">
                    {/* Queue Name & Details */}
                    <td className="py-3 font-semibold text-sq-textPrimary">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-sq-surfaceSecondary text-sq-info flex items-center justify-center font-mono font-bold text-xs">
                          {q.prefix || 'Q'}
                        </span>
                        <div>
                          <span className="block">{q.queueName}</span>
                          <span className="text-[10px] text-sq-muted font-normal">
                            Max Cap: {q.maxCapacity || 'Unlimited'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Total Entries */}
                    <td className="py-3 text-center font-bold text-sq-textPrimary">
                      {q.totalEntries}
                    </td>

                    {/* Completed */}
                    <td className="py-3 text-center font-semibold text-emerald-400">
                      {q.completed}
                    </td>

                    {/* Average Wait */}
                    <td className="py-3 text-center text-sq-textSecondary font-mono">
                      {q.averageWaitMinutes} min
                    </td>

                    {/* Average Service */}
                    <td className="py-3 text-center text-sq-textSecondary font-mono">
                      {q.averageServiceMinutes} min
                    </td>

                    {/* Cancellation Rate */}
                    <td className="py-3 text-center text-amber-400 font-medium">
                      {q.cancellationRate}%
                    </td>

                    {/* No-Show Rate */}
                    <td className="py-3 text-center text-red-400 font-medium">
                      {q.noShowRate}%
                    </td>

                    {/* Currently Waiting */}
                    <td className="py-3 text-center font-black text-sq-primary">
                      {q.currentlyWaiting}
                    </td>

                    {/* Live Crowd Level Badge */}
                    <td className="py-3 text-right">
                      <Badge variant={crowd.variant} size="sm" dot>
                        {crowd.text}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default QueuePerformanceTable;
