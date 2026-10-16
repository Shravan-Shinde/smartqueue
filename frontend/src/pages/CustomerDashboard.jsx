import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Building2,
  ChevronRight,
  Search,
  RefreshCw,
  Clock,
  Ticket,
  Users,
  AlertCircle,
  QrCode,
  History,
  Sparkles,
  ArrowRight,
  XCircle,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import SkeletonLoader from '../components/common/SkeletonLoader';
import EmptyState from '../components/common/EmptyState';
import Toast from '../components/common/Toast';

import queueService from '../services/queueService';
import orgService from '../services/orgService';
import customerHistoryService from '../services/customerHistoryService';
import socketService from '../services/socketService';

/**
 * SmartQueue Customer Primary Dashboard Component
 * Highlights the customer's Active Live Queue Ticket with real-time Socket.IO position tracking,
 * popular organization discovery, and recent visit history.
 */
const CustomerDashboard = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  // Active Queue State
  const [activeData, setActiveData] = useState(null); // { entry, position, peopleAhead, waitTime }
  const [loadingActive, setLoadingActive] = useState(true);

  // Discovery Organizations State
  const [popularOrgs, setPopularOrgs] = useState([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);

  // Recent History State
  const [recentHistory, setRecentHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Toast Alerts
  const [toast, setToast] = useState(null);
  const prevConnStateRef = useRef('OFFLINE');

  // 1. Fetch Active Queue Entry
  const fetchActiveEntry = useCallback(async (showLoading = true) => {
    if (showLoading) setLoadingActive(true);
    try {
      const res = await queueService.getActiveQueueEntry();
      if (res?.success && res?.data) {
        setActiveData(res.data);
      } else {
        setActiveData(null);
      }
    } catch (err) {
      console.error('[ACTIVE QUEUE FETCH ERROR]', err);
      setActiveData(null);
    } finally {
      if (showLoading) setLoadingActive(false);
    }
  }, []);

  // 2. Fetch Featured Organizations
  const fetchOrganizations = useCallback(async () => {
    setLoadingOrgs(true);
    try {
      const res = await orgService.getOrganizations({ limit: 6 });
      if (res?.data?.organizations) {
        setPopularOrgs(res.data.organizations);
      }
    } catch (err) {
      console.error('[ORGS FETCH ERROR]', err);
    } finally {
      setLoadingOrgs(false);
    }
  }, []);

  // 3. Fetch Recent Customer History
  const fetchRecentHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await customerHistoryService.getCustomerHistory({ limit: 3 });
      if (res?.success && res?.data?.items) {
        setRecentHistory(res.data.items);
      }
    } catch (err) {
      console.error('[HISTORY FETCH ERROR]', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Initialize data and real-time Socket.IO subscriptions
  useEffect(() => {
    fetchActiveEntry(true);
    fetchOrganizations();
    fetchRecentHistory();

    // Socket.IO real-time connection
    socketService.connectSocket();

    const unsubState = socketService.onConnectionStateChange((newState) => {
      if (prevConnStateRef.current !== 'CONNECTED' && newState === 'CONNECTED') {
        fetchActiveEntry(false);
      }
      prevConnStateRef.current = newState;
    });

    return () => {
      unsubState();
    };
  }, [fetchActiveEntry, fetchOrganizations, fetchRecentHistory]);

  // Subscribe to socket room for live ticket position updates
  useEffect(() => {
    const queueId = activeData?.entry?.queueId?._id || activeData?.entry?.queueId;
    if (queueId) {
      socketService.subscribeQueue(queueId);
    }

    const unsubYourQueue = socketService.onYourQueueUpdated((data) => {
      if (data && data.entry) {
        setActiveData((prev) => ({
          entry: data.entry,
          position: data.position ?? prev?.position,
          peopleAhead: data.peopleAhead ?? prev?.peopleAhead,
          waitTime: data.waitTime ?? prev?.waitTime,
        }));

        if (data.event === 'CANCELLED' || data.entry?.status === 'CANCELLED') {
          setToast({ type: 'info', message: 'Your queue ticket was cancelled.' });
          fetchActiveEntry(false);
        } else if (data.status === 'CALLED' || data.entry?.status === 'CALLED') {
          setToast({
            type: 'warning',
            message: `🎉 IT IS YOUR TURN! Token ${data.ticketNumber} called to ${data.counterName || 'Counter'}.`,
          });
        } else if (data.status === 'COMPLETED' || data.entry?.status === 'COMPLETED') {
          setToast({ type: 'success', message: 'Service completed! Thank you for using SmartQueue.' });
          fetchActiveEntry(false);
          fetchRecentHistory();
        }
      }
    });

    return () => {
      if (queueId) {
        socketService.unsubscribeQueue(queueId);
      }
      unsubYourQueue();
    };
  }, [activeData?.entry?.queueId, fetchActiveEntry, fetchRecentHistory]);

  const handleCancelActive = async (entryId) => {
    if (!window.confirm('Are you sure you want to leave this queue?')) return;
    try {
      await queueService.cancelQueueEntry(entryId);
      setToast({ type: 'info', message: 'Queue ticket cancelled successfully.' });
      setActiveData(null);
      fetchActiveEntry(true);
      fetchRecentHistory();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to cancel queue ticket.' });
    }
  };

  return (
    <MainLayout roleTitle="Customer Portal">
      <div className="space-y-8 max-w-6xl mx-auto pb-12">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sq-warning pb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-sq-textPrimary tracking-tight">
              Welcome back, <span className="text-sq-primary">{user?.name || 'Customer'}</span>
            </h1>
            <p className="text-xs text-sq-textSecondary mt-1">
              Track your live position in real time, explore services, and review past visits.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/discover">
              <Button variant="primary" size="sm" icon={Search}>
                Discover Services
              </Button>
            </Link>
          </div>
        </div>

        {/* Toast Alert */}
        {toast && (
          <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
        )}

        {/* ============================================================== */}
        {/* 1. PRIMARY SECTION: YOUR LIVE QUEUE CARD                        */}
        {/* ============================================================== */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-sq-textPrimary flex items-center gap-2 uppercase tracking-wider">
              <Ticket className="w-4 h-4 text-sq-primary" />
              <span>Your Live Queue</span>
            </h2>
            <button
              onClick={() => fetchActiveEntry(true)}
              className="text-xs text-sq-textSecondary hover:text-sq-textPrimary flex items-center gap-1 font-medium transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingActive ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {loadingActive ? (
            <div className="h-44 bg-sq-bg rounded-2xl border border-sq-warning animate-pulse" />
          ) : activeData && activeData.entry ? (
            <Card variant="elevated" className="bg-sq-bg border border-sq-borderStrong shadow-2xl relative overflow-hidden">
              {/* Highlight bar */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#87A96B] via-[#C29B72] to-[#865D36]" />

              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pt-2">
                {/* Left: Token info */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-sq-primary text-sq-textPrimary rounded-xl font-black text-2xl tracking-wider shadow-lg">
                      {activeData.entry.ticketNumber}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            activeData.entry.status === 'CALLED'
                              ? 'warning'
                              : activeData.entry.status === 'SERVING'
                              ? 'success'
                              : 'sage'
                          }
                          size="md"
                          dot
                        >
                          {activeData.entry.status}
                        </Badge>
                        <span className="text-[11px] text-sq-muted">
                          Joined {new Date(activeData.entry.joinedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-sq-textPrimary mt-0.5">
                        {activeData.entry.queueId?.name || activeData.entry.departmentId?.name || 'Queue Service'}
                      </h3>
                      <p className="text-xs text-sq-textSecondary flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-sq-primary" />
                        {activeData.entry.organizationId?.name || 'Partner Organization'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Center: Real-time Wait Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-sq-surface rounded-xl border border-sq-warning">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-sq-warning uppercase tracking-wider block">
                      People Ahead
                    </span>
                    <span className="text-xl font-black text-sq-primary">
                      {activeData.peopleAhead ?? 0}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-sq-warning uppercase tracking-wider block">
                      Est. Wait Time
                    </span>
                    <span className="text-xl font-extrabold text-sq-textPrimary">
                      ~{activeData.waitTime?.estimatedWaitMinutes || Math.max(5, (activeData.peopleAhead || 1) * 5)} min
                    </span>
                  </div>

                  <div className="col-span-2 sm:col-span-1 space-y-0.5">
                    <span className="text-[10px] font-bold text-sq-warning uppercase tracking-wider block">
                      Queue Position
                    </span>
                    <span className="text-xl font-black text-sq-textSecondary">
                      #{activeData.position || 1}
                    </span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-row lg:flex-col gap-2 shrink-0">
                  <Link to={`/queue/${activeData.entry._id || activeData.entry.id}`} className="w-full">
                    <Button variant="primary" size="md" icon={QrCode} className="w-full">
                      View QR Token
                    </Button>
                  </Link>

                  <Button
                    variant="ghost"
                    size="sm"
                    icon={XCircle}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => handleCancelActive(activeData.entry._id || activeData.entry.id)}
                  >
                    Cancel Ticket
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card variant="surface" className="bg-sq-bg p-6 text-center space-y-3 border border-sq-warning shadow-md">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-sq-primarySubtle text-sq-textSecondary border border-sq-borderStrong flex items-center justify-center">
                <Ticket className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-sq-textPrimary">You are not currently in a queue</h3>
                <p className="text-xs text-sq-textSecondary max-w-md mx-auto leading-relaxed">
                  Explore partner hospitals, banks, salons, and public bureaus to get a live digital ticket and avoid waiting room crowds.
                </p>
              </div>
              <Link to="/discover">
                <Button variant="primary" size="md" icon={Search}>
                  Explore Services & Join Queue
                </Button>
              </Link>
            </Card>
          )}
        </div>

        {/* ============================================================== */}
        {/* 2. DISCOVER POPULAR ORGANIZATIONS SECTION                        */}
        {/* ============================================================== */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-sq-textPrimary flex items-center gap-2 uppercase tracking-wider">
              <Building2 className="w-4 h-4 text-sq-textSecondary" />
              <span>Explore Partner Organizations</span>
            </h2>
            <Link to="/discover" className="text-xs text-sq-textSecondary hover:underline font-bold flex items-center gap-1">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loadingOrgs ? (
            <SkeletonLoader variant="card" count={3} />
          ) : popularOrgs.length === 0 ? (
            <p className="text-xs text-sq-muted">No featured organizations available.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {popularOrgs.map((org) => (
                <Card key={org._id} hoverEffect className="bg-sq-surface flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-sq-surfaceSecondary text-sq-textSecondary flex items-center justify-center font-bold text-sm border border-sq-border shrink-0">
                        {org.logoUrl ? (
                          <img src={org.logoUrl} alt={org.name} className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          <Building2 className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-sq-textPrimary leading-snug">{org.name}</h4>
                        <Badge variant="pink" size="sm" className="mt-0.5">
                          {org.category}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-sq-textSecondary line-clamp-2 leading-relaxed">
                      {org.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-sq-border flex items-center justify-between">
                    <span className="text-[10px] text-sq-muted flex items-center gap-1">
                      <Clock className="w-3 h-3 text-sq-textSecondary" /> Open Queues Available
                    </span>
                    <Link to={`/organizations/${org._id}`}>
                      <Button variant="secondary" size="sm" icon={ChevronRight}>
                        View Queues
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* 3. RECENT SERVICE HISTORY SECTION                              */}
        {/* ============================================================== */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-sq-textPrimary flex items-center gap-2 uppercase tracking-wider">
              <History className="w-4 h-4 text-sq-textSecondary" />
              <span>Recent Visit Records</span>
            </h2>
            <Link to="/customer/history" className="text-xs text-sq-textSecondary hover:underline font-bold flex items-center gap-1">
              Full History <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loadingHistory ? (
            <div className="h-24 bg-sq-surface rounded-2xl animate-pulse" />
          ) : recentHistory.length === 0 ? (
            <Card variant="surface" className="bg-sq-surface p-4 text-center text-xs text-sq-muted border border-sq-border">
              No completed queue visits recorded yet.
            </Card>
          ) : (
            <div className="space-y-3">
              {recentHistory.map((item) => (
                <div
                  key={item._id || item.id}
                  className="p-4 bg-sq-surface rounded-2xl border border-sq-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-sq-warning transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1.5 bg-sq-surfaceSecondary text-sq-textSecondary rounded-xl font-bold text-sm border border-sq-border">
                      {item.ticketNumber}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-sq-textPrimary">
                        {item.queueId?.name || item.departmentId?.name || 'Service Visit'}
                      </h4>
                      <p className="text-[11px] text-sq-textSecondary">
                        {item.organizationId?.name || 'Organization'} • Visited on{' '}
                        {new Date(item.joinedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        item.status === 'COMPLETED'
                          ? 'success'
                          : item.status === 'CANCELLED'
                          ? 'danger'
                          : 'warning'
                      }
                      size="sm"
                    >
                      {item.status}
                    </Badge>
                    <Link to="/customer/history">
                      <Button variant="secondary" size="sm" icon={ChevronRight}>
                        Details
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default CustomerDashboard;
