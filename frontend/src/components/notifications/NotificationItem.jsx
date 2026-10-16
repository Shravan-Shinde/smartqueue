import React from 'react';
import { Ticket, ArrowUpRight, XCircle, AlertTriangle, Check, Clock } from 'lucide-react';

const getNotificationIcon = (type) => {
  switch (type) {
    case 'QUEUE_JOINED':
      return <Ticket className="w-4 h-4 text-sq-textSecondary" />;
    case 'QUEUE_POSITION_UPDATED':
      return <ArrowUpRight className="w-4 h-4 text-sq-textSecondary" />;
    case 'QUEUE_CANCELLED':
      return <XCircle className="w-4 h-4 text-red-400" />;
    case 'QUEUE_STATUS_CHANGED':
      return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    default:
      return <Clock className="w-4 h-4 text-sq-textSecondary" />;
  }
};

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return 'Just now';
  const diffMs = new Date() - new Date(dateStr);
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const NotificationItem = ({ notification, onMarkRead }) => {
  if (!notification) return null;

  const { id, _id, type, title, message, isRead, createdAt } = notification;
  const notifId = id || _id;

  return (
    <div
      onClick={() => !isRead && onMarkRead && onMarkRead(notifId)}
      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 relative ${
        isRead
          ? 'bg-sq-surfaceSecondary border-sq-border opacity-75 hover:opacity-100 hover:bg-sq-surface'
          : 'bg-sq-surfaceSecondary border-sq-warning hover:border-sq-warning shadow-md shadow-sq-warning/10'
      }`}
    >
      {/* Icon Capsule */}
      <div className="w-8 h-8 rounded-lg bg-sq-bg flex items-center justify-center shrink-0 border border-sq-border mt-0.5">
        {getNotificationIcon(type)}
      </div>

      {/* Content Body */}
      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className={`text-xs font-bold truncate ${isRead ? 'text-sq-textSecondary' : 'text-sq-textPrimary'}`}>
            {title}
          </h4>
          <span className="text-[10px] text-sq-muted shrink-0 font-medium">
            {formatTimeAgo(createdAt)}
          </span>
        </div>
        <p className="text-[11px] text-sq-textSecondary leading-snug mt-1 line-clamp-2">
          {message}
        </p>
      </div>

      {/* Unread Indicator & Mark Read Button */}
      {!isRead && (
        <div className="flex flex-col items-end gap-1.5 shrink-0 self-center">
          <span
            className="w-2 h-2 rounded-full bg-sq-warningBg ring-4 ring-[#AC8968]/20"
            title="Unread notification"
          />
          {onMarkRead && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead(notifId);
              }}
              className="p-1 hover:bg-sq-bg text-sq-muted hover:text-sq-textSecondary rounded-md transition-colors"
              title="Mark as read"
            >
              <Check className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationItem;
