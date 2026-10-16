import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layers, ChevronLeft, RefreshCw } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import SkeletonLoader from '../components/common/SkeletonLoader';
import EmptyState from '../components/common/EmptyState';
import Toast from '../components/common/Toast';
import DigitalTokenCard from '../components/DigitalTokenCard';
import queueService from '../services/queueService';
import socketService from '../services/socketService';

/**
 * SmartQueue Customer Digital Token Live Tracker Page
 * Features Socket.IO real-time ticket updates & position tracking
 */
const QueuePreviewPage = () => {
  const { id } = useParams();

  const [activeData, setActiveData] = useState(null); // { entry, position, peopleAhead }
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);
  const [connectionState, setConnectionState] = useState('OFFLINE');

  const prevConnStateRef = useRef('OFFLINE');

  const fetchActiveEntry = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      let res;
      if (id && id !== 'tracker' && id.length === 24) {
        res = await queueService.getQueueEntryById(id);
      } else {
        res = await queueService.getActiveQueueEntry();
      }
      setActiveData(res.data || null);
    } catch (err) {
      setActiveData(null);
      setToastMessage({ type: 'error', text: err.message || 'Failed to fetch queue entry details.' });
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [id]);

  // Initial fetch & Socket connection setup
  useEffect(() => {
    fetchActiveEntry(true);

    // Initialize socket connection
    socketService.connectSocket();

    // Track connection state & trigger auto-refresh on reconnect
    const unsubState = socketService.onConnectionStateChange((newState) => {
      if (prevConnStateRef.current !== 'CONNECTED' && newState === 'CONNECTED') {
        // Auto-refresh via REST on reconnection to prevent stale state
        fetchActiveEntry(false);
      }
      prevConnStateRef.current = newState;
      setConnectionState(newState);
    });

    return () => {
      unsubState();
    };
  }, [fetchActiveEntry]);

  // Subscribe to queue room and listen to real-time events when activeData changes
  useEffect(() => {
    const queueId = activeData?.entry?.queueId?._id || activeData?.entry?.queueId;
    if (queueId) {
      socketService.subscribeQueue(queueId);
    }

    // Listen for private ticket/position updates
    const unsubYourQueue = socketService.onYourQueueUpdated((data) => {
      if (data && data.entry) {
        setActiveData({
          entry: data.entry,
          position: data.position ?? activeData?.position,
          peopleAhead: data.peopleAhead ?? activeData?.peopleAhead,
        });

        if (data.event === 'CANCELLED' || data.entry.status === 'CANCELLED') {
          setToastMessage({ type: 'info', text: 'Your queue ticket has been cancelled.' });
        } else if (data.event === 'POSITION_UPDATE') {
          setToastMessage({
            type: 'info',
            text: `Queue position updated! You are now #${data.position} (${data.peopleAhead} people ahead).`,
          });
        }
      }
    });

    // Listen for public queue aggregate updates
    const unsubQueueUpdated = socketService.onQueueUpdated((payload) => {
      console.log('[SOCKET CLIENT] Public queue updated:', payload);
    });

    // Listen for queue status changes (e.g. PAUSED / CLOSED)
    const unsubQueueStatus = socketService.onQueueStatusChanged((payload) => {
      if (queueId && payload.queueId === queueId) {
        setToastMessage({
          type: 'warning',
          text: `Queue status updated to ${payload.status}.`,
        });
      }
    });

    return () => {
      if (queueId) {
        socketService.unsubscribeQueue(queueId);
      }
      unsubYourQueue();
      unsubQueueUpdated();
      unsubQueueStatus();
    };
  }, [activeData?.entry?.queueId]);

  const handleCancelEntry = async (entryId) => {
    try {
      await queueService.cancelQueueEntry(entryId);
      setToastMessage({ type: 'info', text: 'Queue entry cancelled successfully.' });
      setActiveData(null);
      fetchActiveEntry(true);
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'Failed to cancel queue entry.' });
    }
  };

  return (
    <MainLayout roleTitle="Live Queue Digital Token">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/dashboard"
            className="text-xs text-sq-info hover:underline flex items-center gap-1 font-semibold"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Customer Dashboard
          </Link>

          <button
            onClick={() => fetchActiveEntry(true)}
            className="px-3 py-1.5 bg-sq-surface hover:bg-sq-surfaceSecondary text-sq-textSecondary hover:text-sq-textPrimary rounded-xl text-xs font-semibold border border-sq-border flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Status
          </button>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <Toast
            type={toastMessage.type}
            message={toastMessage.text}
            onClose={() => setToastMessage(null)}
          />
        )}

        {/* Content Body */}
        {isLoading ? (
          <SkeletonLoader variant="card" count={2} />
        ) : activeData && activeData.entry ? (
          <DigitalTokenCard
            entry={activeData.entry}
            position={activeData.position}
            peopleAhead={activeData.peopleAhead}
            onCancel={handleCancelEntry}
            connectionState={connectionState}
          />
        ) : (
          <EmptyState
            icon={Layers}
            title="You Are Not Currently in a Queue"
            description="Explore partner organizations and service departments to join an open queue and get a digital ticket token."
            actionLabel="Discover Organizations & Services"
            onAction={() => (window.location.href = '/dashboard')}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default QueuePreviewPage;
