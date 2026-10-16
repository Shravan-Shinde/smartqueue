import React from 'react';
import { BarChart3, RefreshCw, Clock } from 'lucide-react';
import Button from '../../common/Button';

/**
 * Header component for Admin Analytics Dashboard
 */
const AnalyticsHeader = ({ lastUpdated, isRefreshing, onRefresh }) => {
  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-sq-surface p-6 rounded-2xl border border-sq-info shadow-xl">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-sq-infoBg text-sq-info flex items-center justify-center font-bold shadow-lg shadow-sm border border-sq-info">
          <BarChart3 className="w-6 h-6" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-sq-textPrimary tracking-tight">
              Admin Analytics Engine
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sq-infoBg text-sq-info border border-sq-info">
              SELECTED PERIOD / HISTORICAL
            </span>
          </div>
          <p className="text-xs text-sq-textSecondary mt-1 leading-relaxed">
            Historical operational metrics, throughput trends, peak hours analysis, and queue performance.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 self-end md:self-auto">
        {formattedTime && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-sq-muted bg-sq-surfaceSecondary px-3 py-2 rounded-xl border border-sq-border">
            <Clock className="w-3.5 h-3.5" />
            <span>Updated {formattedTime}</span>
          </div>
        )}

        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          isDisabled={isRefreshing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sq-textSecondary' : ''}`} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
        </Button>
      </div>
    </div>
  );
};

export default AnalyticsHeader;
