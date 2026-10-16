import React from 'react';
import { Activity, RefreshCw, Clock, Wifi, WifiOff } from 'lucide-react';
import Button from '../../common/Button';
import Badge from '../../common/Badge';

/**
 * Header component for Admin Live Crowd Dashboard with Connection State Badge
 */
const LiveHeader = ({ connectionState, lastUpdated, isRefreshing, onRefresh }) => {
  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  const getConnectionBadge = () => {
    switch (connectionState) {
      case 'CONNECTED':
        return {
          variant: 'success',
          text: 'LIVE REAL-TIME',
          icon: Wifi,
        };
      case 'RECONNECTING':
        return {
          variant: 'warning',
          text: 'RECONNECTING...',
          icon: RefreshCw,
        };
      case 'OFFLINE':
      default:
        return {
          variant: 'danger',
          text: 'LIVE DISCONNECTED',
          icon: WifiOff,
        };
    }
  };

  const statusBadge = getConnectionBadge();
  const StatusIcon = statusBadge.icon;

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-sq-surface p-6 rounded-2xl border border-sq-border shadow-xl">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-sq-primarySubtle text-sq-primary flex items-center justify-center font-bold shadow-lg shadow-sm border border-sq-borderStrong">
          <Activity className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-sq-textPrimary tracking-tight">
              Live Operations & Crowd Monitor
            </h1>
            <Badge variant={statusBadge.variant} size="md" dot>
              <span className="flex items-center gap-1">
                <StatusIcon className={`w-3.5 h-3.5 ${connectionState === 'RECONNECTING' ? 'animate-spin' : ''}`} />
                {statusBadge.text}
              </span>
            </Badge>
          </div>
          <p className="text-xs text-sq-textSecondary mt-1 leading-relaxed">
            Real-time queue depth, active serving counts, crowd levels, and counter capacity monitor.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 self-end md:self-auto">
        {formattedTime && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-sq-muted bg-sq-surfaceSecondary px-3 py-2 rounded-xl border border-sq-border">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {connectionState === 'CONNECTED' ? 'Live Snapshot' : 'Snapshot as of'} {formattedTime}
            </span>
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
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh Snapshot'}</span>
        </Button>
      </div>
    </div>
  );
};

export default LiveHeader;
