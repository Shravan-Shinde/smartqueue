import React from 'react';
import { Building2, MapPin, Ticket, Clock, Star, ChevronRight, Timer } from 'lucide-react';
import Card from '../../common/Card';
import Badge from '../../common/Badge';
import Button from '../../common/Button';

const formatSeconds = (totalSec) => {
  if (totalSec === null || totalSec === undefined) return null;
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
};

/**
 * Single Customer History Service Record Card Component
 * Warm Architectural Palette (#463B32, #AC8968, #D8CBBE)
 */
const HistoryCard = ({ item, onViewDetail, onLeaveReview }) => {
  if (!item) return null;

  const orgName = item.organizationId?.name || 'SmartQueue Partner';
  const locName = item.locationId?.name || 'Location';
  const deptName = item.departmentId?.name || 'Department';
  const queueName = item.queueId?.name || 'Service Queue';
  const ticketNumber = item.ticketNumber || 'TICKET';

  const joinedDateStr = item.joinedAt
    ? new Date(item.joinedAt).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'N/A';

  const statusVariant =
    item.status === 'COMPLETED'
      ? 'success'
      : item.status === 'NO_SHOW'
      ? 'warning'
      : 'danger';

  const waitFormatted = formatSeconds(item.actualWaitDurationSec);
  const serviceFormatted = formatSeconds(item.actualServiceDurationSec);

  return (
    <Card
      variant="surface"
      className="bg-sq-surface p-5 space-y-4 hover:border-sq-warning transition-all border border-sq-border relative overflow-hidden"
    >
      {/* Top Header: Ticket Number & Status */}
      <div className="flex items-center justify-between border-b border-sq-border pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sq-surfaceSecondary text-sq-textSecondary flex items-center justify-center font-black text-sm shrink-0 border border-sq-border">
            <Ticket className="w-5 h-5 text-sq-textSecondary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-sq-textPrimary tracking-tight">
                {ticketNumber}
              </span>
              {item.priority && item.priority !== 'NORMAL' && (
                <Badge variant="pink" size="sm">
                  {item.priority}
                </Badge>
              )}
            </div>
            <span className="text-xs text-sq-textSecondary font-semibold">{queueName}</span>
          </div>
        </div>

        <Badge variant={statusVariant} size="sm">
          {item.status}
        </Badge>
      </div>

      {/* Middle Info: Hierarchy & Timestamps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-sq-textSecondary">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-sq-textPrimary font-bold">
            <Building2 className="w-3.5 h-3.5 text-sq-textSecondary" />
            <span>{orgName}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sq-muted">
            <MapPin className="w-3.5 h-3.5 text-sq-muted" />
            <span>
              {locName} • {deptName}
            </span>
          </div>
        </div>

        <div className="space-y-1 sm:text-right">
          <div className="flex items-center gap-1.5 sm:justify-end text-sq-textSecondary">
            <Clock className="w-3.5 h-3.5" />
            <span>Joined: {joinedDateStr}</span>
          </div>
          {item.calledByCounterId?.name && (
            <div className="text-[11px] text-sq-muted">
              Served at {item.calledByCounterId.name}
            </div>
          )}
        </div>
      </div>

      {/* Metrics Chips & Review Action Bar */}
      <div className="pt-2 border-t border-sq-border flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {waitFormatted && (
            <div className="px-2.5 py-1 bg-sq-surfaceSecondary rounded-lg border border-sq-border text-[11px] font-semibold text-sq-textSecondary flex items-center gap-1">
              <Timer className="w-3.5 h-3.5 text-sq-textSecondary" />
              <span>Wait: {waitFormatted}</span>
            </div>
          )}
          {serviceFormatted && (
            <div className="px-2.5 py-1 bg-sq-surfaceSecondary rounded-lg border border-sq-border text-[11px] font-semibold text-sq-textSecondary flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Service: {serviceFormatted}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {item.review?.submitted ? (
            <div className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-xs font-bold flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              <span>★ {item.review.rating}.0 Reviewed</span>
            </div>
          ) : (
            item.status === 'COMPLETED' && (
              <Button
                variant="secondary"
                size="sm"
                icon={Star}
                onClick={() => onLeaveReview(item)}
              >
                Leave Review
              </Button>
            )
          )}

          <Button
            variant="primary"
            size="sm"
            icon={ChevronRight}
            onClick={() => onViewDetail(item._id || item.id)}
          >
            Details
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default HistoryCard;
