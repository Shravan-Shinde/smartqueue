import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell } from 'lucide-react';
import notificationService from '../../services/notificationService';
import socketService from '../../services/socketService';
import NotificationCenter from './NotificationCenter';
import Toast from '../common/Toast';

const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [liveToast, setLiveToast] = useState(null);

  const containerRef = useRef(null);
  const prevConnRef = useRef('OFFLINE');

  // Fetch unread count from REST API
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await notificationService.getUnreadCount();
      if (res && res.data) {
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      console.warn('[NOTIFICATION BELL] Failed to fetch unread count:', err.message);
    }
  }, []);

  // Fetch notifications list from REST API
  const fetchNotifications = useCallback(
    async (currentPage = 1, isUnreadFilter = false) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await notificationService.getNotifications(currentPage, 10, isUnreadFilter);
        if (res && res.data) {
          setNotifications(res.data.notifications || []);
          setTotalPages(res.data.pagination?.pages || 1);
          setPage(res.data.pagination?.page || 1);
        }
      } catch (err) {
        setError(err.message || 'Failed to load notifications');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Initial load & Socket connection / reconnection setup
  useEffect(() => {
    fetchUnreadCount();
    fetchNotifications(1, unreadOnly);

    // Subscribe to Socket.IO notificationCreated event
    const unsubNotif = socketService.onNotificationCreated((newNotif) => {
      if (newNotif) {
        setNotifications((prev) => [newNotif, ...prev.slice(0, 9)]);
        setUnreadCount((prev) => prev + 1);

        // Show subtle non-blocking live toast
        setLiveToast({
          type: 'info',
          text: `${newNotif.title}: ${newNotif.message}`,
        });
      }
    });

    // Handle Socket reconnection auto-fetch
    const unsubState = socketService.onConnectionStateChange((state) => {
      if (prevConnRef.current !== 'CONNECTED' && state === 'CONNECTED') {
        fetchUnreadCount();
        fetchNotifications(page, unreadOnly);
      }
      prevConnRef.current = state;
    });

    return () => {
      unsubNotif();
      unsubState();
    };
  }, [fetchUnreadCount, fetchNotifications, unreadOnly, page]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleOpen = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      fetchNotifications(1, unreadOnly);
      fetchUnreadCount();
    }
  };

  const handleFilterChange = (isUnread) => {
    setUnreadOnly(isUnread);
    setPage(1);
    fetchNotifications(1, isUnread);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchNotifications(newPage, unreadOnly);
  };

  const handleMarkRead = async (notifId) => {
    try {
      await notificationService.markAsRead(notifId);
      setNotifications((prev) =>
        prev.map((n) => ((n.id || n._id) === notifId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('[NOTIFICATION BELL] Failed to mark read:', err.message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('[NOTIFICATION BELL] Failed to mark all read:', err.message);
    }
  };

  const ariaLabel =
    unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications center';

  return (
    <div className="relative" ref={containerRef}>
      {/* Live Toast Pop */}
      {liveToast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm">
          <Toast
            type={liveToast.type}
            message={liveToast.text}
            onClose={() => setLiveToast(null)}
          />
        </div>
      )}

      {/* Bell Icon Trigger */}
      <button
        onClick={handleToggleOpen}
        aria-label={ariaLabel}
        title={ariaLabel}
        className={`relative p-2 rounded-xl transition-all ${
          isOpen
            ? 'bg-sq-surfaceSecondary text-sq-primary'
            : 'text-sq-textSecondary hover:text-sq-textPrimary hover:bg-sq-surfaceSecondary'
        }`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-sq-primary text-white text-[9px] font-black flex items-center justify-center border-2 border-sq-border shadow-md animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Drawer */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 z-50">
          <NotificationCenter
            notifications={notifications}
            unreadCount={unreadCount}
            isLoading={isLoading}
            error={error}
            page={page}
            totalPages={totalPages}
            unreadOnly={unreadOnly}
            onFilterChange={handleFilterChange}
            onPageChange={handlePageChange}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
            onRefresh={() => {
              fetchNotifications(page, unreadOnly);
              fetchUnreadCount();
            }}
          />
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
