import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertCircle, RefreshCw, Activity, Inbox } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import SkeletonLoader from '../components/common/SkeletonLoader';
import EmptyState from '../components/common/EmptyState';
import Button from '../components/common/Button';

import adminLiveCrowdService from '../services/adminLiveCrowdService';
import socketService from '../services/socketService';

import LiveHeader from '../components/admin/live/LiveHeader';
import LiveSummaryPanel from '../components/admin/live/LiveSummaryPanel';
import LiveFilters from '../components/admin/live/LiveFilters';
import LiveQueueCard from '../components/admin/live/LiveQueueCard';

/**
 * Crowd priority score for UI sorting (VERY HIGH -> HIGH -> MEDIUM -> LOW)
 */
const getCrowdPriorityScore = (level) => {
  switch (level) {
    case 'VERY HIGH':
      return 4;
    case 'HIGH':
      return 3;
    case 'MEDIUM':
      return 2;
    case 'LOW':
    default:
      return 1;
  }
};

/**
 * Main Admin Live Crowd Dashboard Page Component
 */
const AdminLiveCrowdPage = () => {
  // Connection & Data States
  const [connectionState, setConnectionState] = useState('OFFLINE');
  const [snapshotData, setSnapshotData] = useState({ queues: [], summary: {} });

  // Filter & Search States
  const [filterParams, setFilterParams] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  // Status States
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Track previous connection state to detect reconnection
  const prevConnStateRef = useRef('OFFLINE');

  // Fetch REST Snapshot from Backend
  const fetchSnapshot = useCallback(async (params = {}, isManual = false) => {
    if (isManual) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage('');

    try {
      const res = await adminLiveCrowdService.getLiveCrowdSnapshot(params);
      if (res?.success && res.data) {
        setSnapshotData(res.data);
        setLastUpdated(new Date());
      } else {
        setErrorMessage(res?.message || 'Failed to load live crowd snapshot');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error fetching live crowd data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial Snapshot & Filter Effect
  useEffect(() => {
    fetchSnapshot(filterParams);
  }, [fetchSnapshot, filterParams]);

  // Socket Connection & Real-Time Events Setup
  useEffect(() => {
    // 1. Connect Socket client if not connected
    socketService.connectSocket();

    // 2. Listen for Socket Connection State Changes
    const unsubState = socketService.onConnectionStateChange((newState) => {
      setConnectionState(newState);

      // Reconnection Recovery: if transitioning from OFFLINE/RECONNECTING to CONNECTED, refresh snapshot!
      if (prevConnStateRef.current !== 'CONNECTED' && newState === 'CONNECTED') {
        console.log('[LIVE CROWD] Reconnected! Reconciling REST snapshot...');
        fetchSnapshot(filterParams, true);
      }
      prevConnStateRef.current = newState;
    });

    // 3. Subscribe to Admin Live Crowd Socket Room
    socketService.subscribeAdminLive(filterParams.organizationId);

    // 4. Listen for real-time live crowd updates
    const unsubLiveUpdate = socketService.onLiveCrowdUpdated((updatedQueue) => {
      if (!updatedQueue || !updatedQueue.queueId) return;

      setSnapshotData((prevData) => {
        const existingQueues = prevData.queues || [];
        const index = existingQueues.findIndex((q) => q.queueId === updatedQueue.queueId);

        let newQueues;
        if (index >= 0) {
          // Targeted update of matching queue
          newQueues = [...existingQueues];
          newQueues[index] = { ...newQueues[index], ...updatedQueue };
        } else {
          // If queue belongs to current view, append it
          newQueues = [...existingQueues, updatedQueue];
        }

        // Recalculate Summary Totals dynamically
        let totalWaiting = 0;
        let totalServing = 0;
        let openQueues = 0;
        let pausedQueues = 0;
        let closedQueues = 0;
        let highCrowdQueues = 0;
        let veryHighCrowdQueues = 0;

        newQueues.forEach((q) => {
          totalWaiting += q.waiting || 0;
          totalServing += q.serving || 0;

          if (q.status === 'OPEN') openQueues++;
          if (q.status === 'PAUSED') pausedQueues++;
          if (q.status === 'CLOSED') closedQueues++;

          if (q.crowdLevel === 'HIGH') highCrowdQueues++;
          if (q.crowdLevel === 'VERY HIGH') veryHighCrowdQueues++;
        });

        setLastUpdated(new Date());

        return {
          queues: newQueues,
          summary: {
            totalWaiting,
            totalServing,
            openQueues,
            pausedQueues,
            closedQueues,
            highCrowdQueues,
            veryHighCrowdQueues,
            totalQueues: newQueues.length,
          },
        };
      });
    });

    // Clean up socket subscriptions on unmount / filter change
    return () => {
      unsubState();
      unsubLiveUpdate();
      socketService.unsubscribeAdminLive(filterParams.organizationId);
    };
  }, [filterParams, fetchSnapshot]);

  // Filter Change Handler
  const handleFilterChange = (newFilters) => {
    setFilterParams(newFilters);
  };

  // Manual Refresh Handler
  const handleRefresh = () => {
    fetchSnapshot(filterParams, true);
  };

  // Client-Side Search & Priority Queue Sorting
  const getProcessedQueues = () => {
    let list = [...(snapshotData.queues || [])];

    // Filter by crowd focus dropdown
    if (filterParams.crowdFilter === 'HIGH_ONLY') {
      list = list.filter((q) => q.crowdLevel === 'HIGH' || q.crowdLevel === 'VERY HIGH');
    } else if (filterParams.crowdFilter === 'OPEN_ONLY') {
      list = list.filter((q) => q.status === 'OPEN');
    }

    // Filter by Search Term
    if (searchTerm.trim()) {
      const qLower = searchTerm.trim().toLowerCase();
      list = list.filter(
        (q) =>
          q.queueName?.toLowerCase().includes(qLower) ||
          q.prefix?.toLowerCase().includes(qLower) ||
          q.departmentName?.toLowerCase().includes(qLower)
      );
    }

    // Sort queues operationally: VERY HIGH -> HIGH -> MEDIUM -> LOW, then by waiting count desc
    list.sort((a, b) => {
      const scoreA = getCrowdPriorityScore(a.crowdLevel);
      const scoreB = getCrowdPriorityScore(b.crowdLevel);
      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Highest crowd level first
      }
      return (b.waiting || 0) - (a.waiting || 0); // Highest waiting count first
    });

    return list;
  };

  const processedQueues = getProcessedQueues();

  return (
    <MainLayout roleTitle="Admin Operations Center">
      <div className="space-y-6">
        {/* Live Header */}
        <LiveHeader
          connectionState={connectionState}
          lastUpdated={lastUpdated}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />

        {/* Live Filters & Search */}
        <LiveFilters
          onFilterChange={handleFilterChange}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          isLoading={isLoading || isRefreshing}
        />

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-red-400">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-xs font-semibold">{errorMessage}</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              className="flex items-center gap-1.5 self-end sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Snapshot</span>
            </Button>
          </div>
        )}

        {/* Dashboard Content */}
        {isLoading ? (
          <div className="space-y-6">
            <SkeletonLoader variant="card" count={6} />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Live Operational Summary Panel */}
            <LiveSummaryPanel summary={snapshotData.summary} />

            {/* Queue Cards Operational Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-extrabold text-sq-muted uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-sq-primary" />
                  Active Queue Operational Cards ({processedQueues.length})
                </h3>
                <span className="text-xs text-sq-textSecondary">
                  Sorted by operational priority (Crowd level & Waiting count)
                </span>
              </div>

              {processedQueues.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="No Live Queues Found"
                  description="No active queue monitors match your current filter parameters or search criteria."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {processedQueues.map((queue) => (
                    <LiveQueueCard key={queue.queueId} queue={queue} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AdminLiveCrowdPage;
