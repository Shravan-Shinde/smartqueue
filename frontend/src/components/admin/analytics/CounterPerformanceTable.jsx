import React, { useState } from 'react';
import { Monitor, Search, Info, UserCheck, Wrench } from 'lucide-react';
import Badge from '../../common/Badge';
import EmptyState from '../../common/EmptyState';

/**
 * Counter status badge variant helper
 */
const getCounterStatusVariant = (status) => {
  switch (status) {
    case 'AVAILABLE':
      return { variant: 'success', text: 'AVAILABLE' };
    case 'BUSY':
      return { variant: 'warning', text: 'BUSY' };
    case 'OFFLINE':
      return { variant: 'default', text: 'OFFLINE' };
    default:
      return { variant: 'default', text: status || 'OFFLINE' };
  }
};

/**
 * Counter Performance Table Component
 */
const CounterPerformanceTable = ({ data = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCounters = data.filter((c) =>
    c.counterName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.assignedStaffName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.departmentName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-sq-surface p-5 rounded-2xl border border-sq-border shadow-lg space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-sq-textPrimary flex items-center gap-2">
            <Monitor className="w-5 h-5 text-sq-info" />
            Counter Operational Performance
          </h3>
          <p className="text-xs text-sq-textSecondary mt-0.5">
            Staff counter status, completed ticket count, average service times, and operational load
          </p>
        </div>

        {data.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-sq-muted" />
            <input
              type="text"
              placeholder="Search counter, staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-sq-surfaceSecondary text-xs text-sq-textPrimary placeholder-sq-muted rounded-xl pl-9 pr-3 py-1.5 border border-sq-border focus:outline-none focus:border-sq-primary"
            />
          </div>
        )}
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={Monitor}
          title="No Counter Metrics Available"
          description="There are no counter activity records found for the selected filter parameters."
        />
      ) : filteredCounters.length === 0 ? (
        <p className="text-xs text-sq-muted py-6 text-center">No counters match your search criteria.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-sq-border text-sq-muted uppercase text-[10px]">
                <th className="pb-3 font-bold">Counter</th>
                <th className="pb-3 font-bold">Department</th>
                <th className="pb-3 font-bold">Assigned Staff</th>
                <th className="pb-3 font-bold text-center">Status</th>
                <th className="pb-3 font-bold text-center">Completed Services</th>
                <th className="pb-3 font-bold text-center">Avg Service Time</th>
                <th className="pb-3 font-bold text-right">
                  <span className="inline-flex items-center gap-1">
                    Handled Services
                    <span
                      className="cursor-help text-sq-info"
                      title="Handled services represents operational load proxy. True time-based utilization requires counter state duration logging."
                    >
                      <Info className="w-3.5 h-3.5" />
                    </span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredCounters.map((c) => {
                const statusBadge = getCounterStatusVariant(c.status);
                return (
                  <tr key={c.counterId} className="hover:bg-white/5 transition-colors">
                    {/* Counter Name & Number */}
                    <td className="py-3 font-semibold text-sq-textPrimary">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-sq-surfaceSecondary text-sq-primary flex items-center justify-center font-bold text-xs">
                          <Monitor className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span>{c.counterName}</span>
                          {c.number && (
                            <span className="text-[10px] text-sq-muted block">#{c.number}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="py-3 text-sq-textSecondary font-medium">
                      {c.departmentName || 'N/A'}
                    </td>

                    {/* Assigned Staff */}
                    <td className="py-3 text-sq-textPrimary font-medium">
                      <div className="flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-sq-info" />
                        <span>{c.assignedStaffName || 'Unassigned'}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 text-center">
                      <Badge variant={statusBadge.variant} size="sm" dot>
                        {statusBadge.text}
                      </Badge>
                    </td>

                    {/* Completed Services */}
                    <td className="py-3 text-center font-bold text-sq-textPrimary">
                      {c.completedServices}
                    </td>

                    {/* Average Service Duration */}
                    <td className="py-3 text-center text-sq-textSecondary font-mono">
                      {c.averageServiceMinutes} min
                    </td>

                    {/* Handled Services Proxy */}
                    <td className="py-3 text-right font-extrabold text-sq-info">
                      {c.handledServices} tickets
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

export default CounterPerformanceTable;
