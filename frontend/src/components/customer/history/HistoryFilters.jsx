import React from 'react';
import { Filter, RotateCcw, Calendar, CheckCircle2 } from 'lucide-react';
import Button from '../../common/Button';

const getPresetDates = (presetKey) => {
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (presetKey === 'LAST_7_DAYS') {
    const d7 = new Date(now);
    d7.setDate(d7.getDate() - 6);
    d7.setHours(0, 0, 0, 0);
    return {
      dateFrom: d7.toISOString().split('T')[0],
      dateTo: todayEnd.toISOString().split('T')[0],
    };
  }

  if (presetKey === 'LAST_30_DAYS') {
    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 29);
    d30.setHours(0, 0, 0, 0);
    return {
      dateFrom: d30.toISOString().split('T')[0],
      dateTo: todayEnd.toISOString().split('T')[0],
    };
  }

  return { dateFrom: '', dateTo: '' };
};

const HistoryFilters = ({ filters, onFilterChange, onReset }) => {
  const handlePresetSelect = (preset) => {
    if (preset === 'CUSTOM') {
      onFilterChange({ datePreset: 'CUSTOM' });
    } else {
      const dates = getPresetDates(preset);
      onFilterChange({ datePreset: preset, ...dates });
    }
  };

  return (
    <div className="bg-sq-surface p-4 sm:p-5 rounded-2xl border border-sq-border space-y-4">
      <div className="flex items-center justify-between border-b border-sq-border pb-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sq-textPrimary">
          <Filter className="w-4 h-4 text-sq-textSecondary" />
          <span>Filter Service History</span>
        </div>
        <Button variant="ghost" size="sm" icon={RotateCcw} onClick={onReset}>
          Clear Filters
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Filter */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-sq-textSecondary flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Visit Status
          </label>
          <select
            value={filters.status || ''}
            onChange={(e) => onFilterChange({ status: e.target.value })}
            className="w-full bg-sq-surfaceSecondary border border-sq-border rounded-xl px-3 py-2 text-xs text-sq-textPrimary focus:outline-none focus:border-sq-warning"
          >
            <option value="">All Statuses (Completed, No-Show, Cancelled)</option>
            <option value="COMPLETED">Completed</option>
            <option value="NO_SHOW">No Show</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* Date Range Preset */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-sq-textSecondary flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-sq-textSecondary" /> Time Period
          </label>
          <select
            value={filters.datePreset || 'ALL'}
            onChange={(e) => handlePresetSelect(e.target.value)}
            className="w-full bg-sq-surfaceSecondary border border-sq-border rounded-xl px-3 py-2 text-xs text-sq-textPrimary focus:outline-none focus:border-sq-warning"
          >
            <option value="ALL">All Time</option>
            <option value="LAST_7_DAYS">Last 7 Days</option>
            <option value="LAST_30_DAYS">Last 30 Days</option>
            <option value="CUSTOM">Custom Date Range</option>
          </select>
        </div>

        {/* Custom Date From */}
        {filters.datePreset === 'CUSTOM' && (
          <>
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-sq-textSecondary">
                From Date
              </label>
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => onFilterChange({ dateFrom: e.target.value })}
                className="w-full bg-sq-surfaceSecondary border border-sq-border rounded-xl px-3 py-2 text-xs text-sq-textPrimary focus:outline-none focus:border-sq-warning"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-sq-textSecondary">
                To Date
              </label>
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => onFilterChange({ dateTo: e.target.value })}
                className="w-full bg-sq-surfaceSecondary border border-sq-border rounded-xl px-3 py-2 text-xs text-sq-textPrimary focus:outline-none focus:border-sq-warning"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HistoryFilters;
