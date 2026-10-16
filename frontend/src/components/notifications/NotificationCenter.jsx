import React, { useState } from 'react';
import { Bell, CheckCheck, RefreshCw, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import NotificationItem from './NotificationItem';
import Button from '../common/Button';

const NotificationCenter = ({
  notifications = [],
  unreadCount = 0,
  isLoading = false,
  error = null,
  page = 1,
  totalPages = 1,
  unreadOnly = false,
  onFilterChange,
  onPageChange,
  onMarkRead,
  onMarkAllRead,
  onRefresh,
}) => {
  return (
    <div className="w-full max-w-md bg-sq-surface border border-sq-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-sq-textPrimary">
      {/* Drawer Header */}
      <div className="p-4 border-b border-sq-border bg-sq-surfaceSecondary flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-sq-primary" />
          <h3 className="text-sm font-bold text-sq-textPrimary">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-sq-primarySubtle text-sq-primary text-[10px] font-extrabold">
              {unreadCount} unread
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && onMarkAllRead && (
            <button
              onClick={onMarkAllRead}
              className="text-[11px] font-semibold text-sq-info hover:text-white flex items-center gap-1 transition-colors"
              title="Mark all notifications as read"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
          )}

          <button
            onClick={onRefresh}
            className="p-1.5 text-sq-textSecondary hover:text-sq-textPrimary hover:bg-sq-surfaceSecondary rounded-lg transition-colors"
            title="Refresh notifications"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center border-b border-sq-border px-4 bg-sq-bg text-xs font-semibold shrink-0">
        <button
          onClick={() => onFilterChange && onFilterChange(false)}
          className={`py-2.5 px-3 border-b-2 transition-all ${
            !unreadOnly
              ? 'border-sq-primary text-sq-primary'
              : 'border-transparent text-sq-textSecondary hover:text-sq-textPrimary'
          }`}
        >
          All
        </button>
        <button
          onClick={() => onFilterChange && onFilterChange(true)}
          className={`py-2.5 px-3 border-b-2 transition-all ${
            unreadOnly
              ? 'border-sq-primary text-sq-primary'
              : 'border-transparent text-sq-textSecondary hover:text-sq-textPrimary'
          }`}
        >
          Unread Only {unreadCount > 0 && `(${unreadCount})`}
        </button>
      </div>

      {/* Notification Body List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[220px]">
        {isLoading ? (
          <div className="space-y-2.5 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3 bg-sq-surfaceSecondary rounded-xl animate-pulse h-16" />
            ))}
          </div>
        ) : error ? (
          <div className="py-8 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
            <p className="text-xs text-sq-textSecondary">{error}</p>
            <Button variant="secondary" size="sm" onClick={onRefresh}>
              Retry Load
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center space-y-2.5">
            <div className="w-10 h-10 rounded-2xl bg-sq-bg text-sq-muted flex items-center justify-center mx-auto border border-sq-border">
              <Bell className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-sq-textPrimary">No notifications yet</p>
            <p className="text-[11px] text-sq-muted max-w-xs mx-auto">
              Queue token updates, position advancements, and service status changes will appear here.
            </p>
          </div>
        ) : (
          notifications.map((notif) => (
            <NotificationItem
              key={notif.id || notif._id}
              notification={notif}
              onMarkRead={onMarkRead}
            />
          ))
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-sq-border bg-sq-surfaceSecondary flex items-center justify-between text-xs shrink-0">
          <span className="text-[11px] text-sq-muted">
            Page {page} of {totalPages}
          </span>

          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange && onPageChange(page - 1)}
              className="p-1 rounded-lg border border-sq-border bg-sq-surface hover:bg-sq-surfaceSecondary text-sq-textSecondary disabled:opacity-30 disabled:hover:bg-sq-surface transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange && onPageChange(page + 1)}
              className="p-1 rounded-lg border border-sq-border bg-sq-surface hover:bg-sq-surfaceSecondary text-sq-textSecondary disabled:opacity-30 disabled:hover:bg-sq-surface transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
