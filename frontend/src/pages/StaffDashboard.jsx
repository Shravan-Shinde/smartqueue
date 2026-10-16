import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Monitor,
  PhoneCall,
  Play,
  CheckCircle2,
  UserX,
  Clock,
  User,
  Activity,
  Layers,
  RefreshCw,
  AlertTriangle,
  Building2,
  MapPin,
  QrCode,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Toast from '../components/common/Toast';
import SkeletonLoader from '../components/common/SkeletonLoader';
import EmptyState from '../components/common/EmptyState';
import QrCheckInModal from '../components/staff/QrCheckInModal';

import staffService from '../services/staffService';
import socketService from '../services/socketService';

/**
 * SmartQueue Real-Time Staff Operational Terminal Dashboard
 */
const StaffDashboard = () => {
  const [data, setData] = useState(null); // { counter, counters, department, queue, queues, currentEntry }
  const [selectedCounterId, setSelectedCounterId] = useState('');
  const [selectedQueueId, setSelectedQueueId] = useState('');
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isQueueLoading, setIsQueueLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [isNoShowModalOpen, setIsNoShowModalOpen] = useState(false);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [isQrCheckInModalOpen, setIsQrCheckInModalOpen] = useState(false);
  const [targetEmergencyItem, setTargetEmergencyItem] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [connectionState, setConnectionState] = useState('OFFLINE');

  // Live Timer State (MM:SS) calculated from server `startedAt`
  const [timerDisplay, setTimerDisplay] = useState('00:00');

  const prevConnRef = useRef('OFFLINE');

  // Fetch waiting stream list for a specific queue
  const fetchWaitingQueue = useCallback(async (queueId, counterId = null) => {
    if (!queueId) return;
    setIsQueueLoading(true);
    try {
      const res = await staffService.getWaitingQueue(queueId, counterId);
      if (res && res.data) {
        setWaitingQueue(res.data || []);
      }
    } catch (err) {
      console.warn('[STAFF DASHBOARD] Failed to load waiting queue:', err.message);
    } finally {
      setIsQueueLoading(false);
    }
  }, []);

  // Fetch staff counter & current active entry
  const fetchStaffData = useCallback(async (showLoading = true, counterIdOverride = null) => {
    if (showLoading) setIsLoading(true);
    try {
      const targetCounterId = counterIdOverride || selectedCounterId || undefined;
      const res = await staffService.getMyCounter(targetCounterId);
      if (res && res.data) {
        setData(res.data);
        if (res.data.counter?._id && !selectedCounterId) {
          setSelectedCounterId(res.data.counter._id);
        }
        const queues = res.data.queues || (res.data.queue ? [res.data.queue] : []);
        setSelectedQueueId((currentQId) => {
          if (currentQId && queues.some((q) => (q._id || q.id) === currentQId)) {
            return currentQId;
          }
          return res.data.queue?._id || queues[0]?._id || '';
        });
      } else {
        setData(null);
      }
    } catch (err) {
      setData(null);
      setToast({ type: 'error', text: err.message || 'Failed to load staff counter assignment.' });
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [selectedCounterId]);

  // Initial setup & Socket connection listeners
  useEffect(() => {
    fetchStaffData(true);

    socketService.connectSocket();

    const unsubState = socketService.onConnectionStateChange((state) => {
      if (prevConnRef.current !== 'CONNECTED' && state === 'CONNECTED') {
        fetchStaffData(false);
      }
      prevConnRef.current = state;
      setConnectionState(state);
    });

    return () => {
      unsubState();
    };
  }, [fetchStaffData]);

  // Subscribe to Queue Room when selectedQueueId is present
  useEffect(() => {
    if (selectedQueueId) {
      fetchWaitingQueue(selectedQueueId, data?.counter?._id);
      socketService.subscribeQueue(selectedQueueId);

      const unsubQueueUpdated = socketService.onQueueUpdated(() => {
        fetchWaitingQueue(selectedQueueId, data?.counter?._id);
      });

      return () => {
        socketService.unsubscribeQueue(selectedQueueId);
        unsubQueueUpdated();
      };
    }
  }, [selectedQueueId, data?.counter?._id, fetchWaitingQueue]);

  // Live Timer Interval (Calculates MM:SS from server `startedAt` timestamp)
  useEffect(() => {
    const currentEntry = data?.currentEntry;
    if (!currentEntry || currentEntry.status !== 'SERVING' || !currentEntry.startedAt) {
      setTimerDisplay('00:00');
      return;
    }

    const updateTimer = () => {
      const startMs = new Date(currentEntry.startedAt).getTime();
      const nowMs = Date.now();
      const elapsedSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));

      const mins = Math.floor(elapsedSec / 60);
      const secs = elapsedSec % 60;

      const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      setTimerDisplay(formatted);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [data?.currentEntry]);

  // Staff Action Handlers
  const handleToggleCounterStatus = async (targetStatus) => {
    setActionLoading(true);
    try {
      const res = await staffService.updateCounterStatus(targetStatus);
      setToast({ type: 'success', text: res.message || `Counter status set to ${targetStatus}` });
      fetchStaffData(false);
    } catch (err) {
      setToast({ type: 'error', text: err.message || `Failed to update counter status to ${targetStatus}` });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrioritySelect = async (item, newPriority) => {
    if (newPriority === 'EMERGENCY') {
      setTargetEmergencyItem(item);
      setIsEmergencyModalOpen(true);
      return;
    }
    await applyPriorityChange(item._id || item.id, newPriority);
  };

  const handleSwitchCounter = (counterId) => {
    setSelectedCounterId(counterId);
    setSelectedQueueId('');
    fetchStaffData(true, counterId);
  };

  const applyPriorityChange = async (entryId, newPriority) => {
    setActionLoading(true);
    try {
      const res = await staffService.updateEntryPriority(entryId, newPriority);
      setToast({ type: 'success', text: res.message || `Updated priority to ${newPriority}` });
      const currentQId = selectedQueueId || data?.queue?._id;
      if (currentQId) fetchWaitingQueue(currentQId, data?.counter?._id);
    } catch (err) {
      setToast({ type: 'error', text: err.message || 'Failed to update priority.' });
    } finally {
      setActionLoading(false);
      setIsEmergencyModalOpen(false);
      setTargetEmergencyItem(null);
    }
  };

  const handleCallNext = async () => {
    const queueToCall = selectedQueueId || data?.queue?._id;
    if (!queueToCall) return;
    setActionLoading(true);
    try {
      const res = await staffService.callNext(queueToCall, data?.counter?._id);
      setToast({ type: 'success', text: res.message || 'Called next customer.' });
      fetchStaffData(false);
    } catch (err) {
      setToast({ type: 'error', text: err.message || 'Failed to call next customer.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartService = async () => {
    if (!data?.currentEntry?._id && !data?.currentEntry?.id) return;
    const entryId = data.currentEntry._id || data.currentEntry.id;
    setActionLoading(true);
    try {
      const res = await staffService.startService(entryId);
      setToast({ type: 'success', text: res.message || 'Service started.' });
      fetchStaffData(false);
    } catch (err) {
      setToast({ type: 'error', text: err.message || 'Failed to start service.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteService = async () => {
    if (!data?.currentEntry?._id && !data?.currentEntry?.id) return;
    const entryId = data.currentEntry._id || data.currentEntry.id;
    setActionLoading(true);
    try {
      const res = await staffService.completeService(entryId);
      setToast({ type: 'success', text: res.message || 'Service completed successfully.' });
      fetchStaffData(false);
    } catch (err) {
      setToast({ type: 'error', text: err.message || 'Failed to complete service.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmNoShow = async () => {
    if (!data?.currentEntry?._id && !data?.currentEntry?.id) return;
    const entryId = data.currentEntry._id || data.currentEntry.id;
    setActionLoading(true);
    try {
      const res = await staffService.noShow(entryId);
      setToast({ type: 'info', text: res.message || 'Customer marked as NO_SHOW.' });
      setIsNoShowModalOpen(false);
      fetchStaffData(false);
    } catch (err) {
      setToast({ type: 'error', text: err.message || 'Failed to mark no-show.' });
    } finally {
      setActionLoading(false);
    }
  };

  const counter = data?.counter;
  const department = data?.department;
  const queue = data?.queue;
  const currentEntry = data?.currentEntry;

  const isServing = currentEntry?.status === 'SERVING';
  const isCalled = currentEntry?.status === 'CALLED';
  const hasActiveCustomer = isCalled || isServing;

  return (
    <MainLayout roleTitle="Staff Counter Terminal">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Toast Alerts */}
        {toast && (
          <Toast type={toast.type} message={toast.text} onClose={() => setToast(null)} />
        )}

        {/* Loading State */}
        {isLoading ? (
          <SkeletonLoader variant="card" count={3} />
        ) : !counter ? (
          /* No Counter Assigned Empty State */
          <EmptyState
            icon={Monitor}
            title="No Active Counter Assigned"
            description="Your staff user account is currently not assigned to an active counter. Please ask an Administrator to assign you to a counter terminal."
            actionLabel="Refresh Assignment Status"
            onAction={() => fetchStaffData(true)}
          />
        ) : (
          <>
            {/* Header Banner: Assigned Counter Info */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-sq-surface p-6 rounded-2xl border border-sq-border shadow-xl">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#287D91] via-[#B27BDD] to-[#F16B99] flex items-center justify-center text-white font-black text-xl shadow-lg shrink-0">
                  {counter.number || 'C-1'}
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-bold text-sq-textPrimary">
                      {counter.name} — {department?.name || 'Department'}
                    </h1>
                    <Badge
                      variant={
                        counter.status === 'BUSY'
                          ? 'danger'
                          : counter.status === 'AVAILABLE'
                          ? 'success'
                          : 'secondary'
                      }
                      size="sm"
                      dot
                    >
                      {counter.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-sq-textSecondary flex items-center gap-2 mt-1">
                    <Building2 className="w-3.5 h-3.5 text-sq-muted" />
                    {counter.organizationId?.name || 'Organization'} • {counter.locationId?.name || 'Location'}
                  </p>
                  {data?.counters && data.counters.length > 1 && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[11px] font-semibold text-sq-muted">Assigned Counter:</span>
                      <select
                        value={counter._id}
                        onChange={(e) => handleSwitchCounter(e.target.value)}
                        aria-label="Switch assigned counter"
                        className="bg-sq-surfaceSecondary text-xs font-bold text-sq-textPrimary rounded-lg px-2.5 py-1 border border-sq-border focus:outline-none focus:border-sq-primary"
                      >
                        {data.counters.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name} ({c.number})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Controls & Refresh */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Counter Availability Toggle */}
                {counter.status === 'AVAILABLE' && (
                  <Button
                    variant="danger"
                    size="sm"
                    isLoading={actionLoading}
                    disabled={hasActiveCustomer}
                    onClick={() => handleToggleCounterStatus('OFFLINE')}
                  >
                    Take Counter Offline
                  </Button>
                )}
                {counter.status === 'OFFLINE' && (
                  <Button
                    variant="success"
                    size="sm"
                    isLoading={actionLoading}
                    onClick={() => handleToggleCounterStatus('AVAILABLE')}
                  >
                    Set Available
                  </Button>
                )}
                {counter.status === 'BUSY' && (
                  <Badge variant="danger" size="sm" dot font-bold>
                    BUSY (IN SERVICE)
                  </Badge>
                )}

                <Badge
                  variant={connectionState === 'CONNECTED' ? 'success' : 'warning'}
                  size="sm"
                  dot
                >
                  SOCKET: {connectionState}
                </Badge>

                {/* QR Check-In Action Button */}
                <Button
                  variant="primary"
                  size="sm"
                  icon={QrCode}
                  onClick={() => setIsQrCheckInModalOpen(true)}
                >
                  QR Check-In
                </Button>

                <button
                  onClick={() => fetchStaffData(true)}
                  className="px-3 py-1.5 bg-sq-bg hover:bg-sq-surfaceSecondary text-sq-textSecondary hover:text-sq-textPrimary rounded-xl text-xs font-semibold border border-sq-border flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Terminal
                </button>
              </div>
            </div>

            {/* Operational Terminal Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Current Active Ticket Control (Left 2 Columns) */}
              <Card variant="elevated" className="lg:col-span-2 space-y-6 border-l-4 border-l-[#F16B99]">
                <div className="flex items-center justify-between border-b border-sq-border pb-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-sq-primary flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Operational Console
                  </span>
                  {currentEntry ? (
                    <Badge variant={isServing ? 'success' : 'pink'} size="sm" dot font-bold>
                      STATUS: {currentEntry.status}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" size="sm">STATUS: IDLE</Badge>
                  )}
                </div>

                {/* Active Customer Box */}
                {currentEntry ? (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-6 bg-sq-surfaceSecondary rounded-2xl border border-sq-border">
                    <div className="text-center sm:text-left space-y-1">
                      <span className="text-xs text-sq-muted font-semibold uppercase tracking-wider">
                        {queue?.name || 'Active Ticket'}
                      </span>
                      <div className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#F16B99] via-[#B27BDD] to-[#287D91] tracking-tight py-1">
                        {currentEntry.ticketNumber || 'TOKEN-000'}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-sq-textSecondary pt-1">
                        <User className="w-4 h-4 text-sq-info" />
                        <span className="font-semibold text-sq-textPrimary">
                          Sequence #{currentEntry.sequenceNumber || 1}
                        </span>
                        {currentEntry.priority && (
                          <Badge
                            variant={
                              currentEntry.priority === 'EMERGENCY'
                                ? 'danger'
                                : currentEntry.priority === 'PRIORITY'
                                ? 'pink'
                                : currentEntry.priority === 'APPOINTMENT'
                                ? 'warning'
                                : 'secondary'
                            }
                            size="sm"
                          >
                            {currentEntry.priority}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Live Server-Authoritative Service Timer */}
                    <div className="text-center p-4 bg-sq-surfaceSecondary rounded-2xl border border-sq-border w-full sm:w-36 shrink-0">
                      <span className="text-[10px] uppercase font-bold text-sq-muted tracking-wider block">
                        Service Timer
                      </span>
                      <div className="text-3xl font-mono font-bold text-sq-info mt-1 flex items-center justify-center gap-1.5">
                        <Clock className={`w-5 h-5 text-sq-info ${isServing ? 'animate-pulse' : ''}`} />
                        {timerDisplay}
                      </div>
                      <span className="text-[10px] text-sq-muted mt-1 block">
                        Avg: {queue?.avgServiceTimeMins || 15}m
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Idle Counter State */
                  <div className="py-12 text-center space-y-3 bg-sq-surfaceSecondary rounded-2xl border border-sq-border">
                    <div className="w-12 h-12 rounded-2xl bg-sq-surfaceSecondary text-sq-muted flex items-center justify-center mx-auto">
                      <Monitor className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-sq-textPrimary">Counter is Idle</p>
                    <p className="text-xs text-sq-muted max-w-sm mx-auto">
                      No customer currently called or being served. Click "Call Next" to invite the next customer from the waiting queue.
                    </p>
                  </div>
                )}

                {/* Staff Action Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <Button
                    variant="primary"
                    icon={PhoneCall}
                    isLoading={actionLoading}
                    disabled={hasActiveCustomer || counter.status === 'OFFLINE' || waitingQueue.length === 0}
                    onClick={handleCallNext}
                  >
                    Call Next
                  </Button>

                  <Button
                    variant="secondary"
                    icon={Play}
                    isLoading={actionLoading}
                    disabled={!isCalled}
                    onClick={handleStartService}
                  >
                    Start Service
                  </Button>

                  <Button
                    variant="success"
                    icon={CheckCircle2}
                    isLoading={actionLoading}
                    disabled={!isServing}
                    onClick={handleCompleteService}
                  >
                    Complete
                  </Button>

                  <Button
                    variant="danger"
                    icon={UserX}
                    isLoading={actionLoading}
                    disabled={!currentEntry || isServing}
                    onClick={() => setIsNoShowModalOpen(true)}
                  >
                    No Show
                  </Button>
                </div>
              </Card>

              {/* Waiting Stream Column (Right Column) */}
              <Card variant="surface" className="space-y-4">
                <div className="flex items-center justify-between border-b border-sq-border pb-3">
                  <h3 className="text-base font-bold text-sq-textPrimary flex items-center gap-2">
                    <Layers className="w-4 h-4 text-sq-info" /> Waiting Stream
                  </h3>
                  <Badge variant="warning" size="sm">
                    {waitingQueue.length} Waiting
                  </Badge>
                </div>

                {/* Multi-Service Queue Selector */}
                {data?.queues && data.queues.length > 1 && (
                  <div className="space-y-1.5 pb-2 border-b border-sq-border">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-sq-muted block">
                      Select Service Queue ({data.queues.length} Available)
                    </span>
                    <div className="grid grid-cols-1 gap-1.5">
                      {data.queues.map((q) => {
                        const isSelected = (selectedQueueId || data?.queue?._id) === (q._id || q.id);
                        return (
                          <button
                            key={q._id || q.id}
                            type="button"
                            onClick={() => setSelectedQueueId(q._id || q.id)}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left ${
                              isSelected
                                ? 'bg-sq-primary/10 border-sq-primary text-sq-primary shadow-sm'
                                : 'bg-sq-surfaceSecondary border-sq-border text-sq-textSecondary hover:text-sq-textPrimary hover:border-sq-border'
                            }`}
                          >
                            <span className="truncate">{q.name} ({q.prefix})</span>
                            <Badge variant={isSelected ? 'pink' : 'secondary'} size="sm">
                              {q.status || 'OPEN'}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {isQueueLoading ? (
                    <div className="space-y-2 py-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="p-3 bg-sq-surfaceSecondary rounded-xl animate-pulse h-12" />
                      ))}
                    </div>
                  ) : waitingQueue.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <p className="text-xs font-semibold text-sq-textPrimary">Queue is Empty</p>
                      <p className="text-[11px] text-sq-muted">
                        There are no customers currently waiting in this queue.
                      </p>
                    </div>
                  ) : (
                    waitingQueue.map((item, idx) => (
                      <div
                        key={item._id || item.id}
                        className="p-3 bg-sq-surfaceSecondary border border-sq-border rounded-xl flex items-center justify-between hover:border-sq-border transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-lg bg-sq-surfaceSecondary text-sq-info flex items-center justify-center text-xs font-bold font-mono">
                            #{idx + 1}
                          </span>
                          <div>
                            <h4 className="text-xs font-bold text-sq-textPrimary">
                              {item.ticketNumber}
                            </h4>
                            <span className="text-[10px] text-sq-muted">
                              Seq #{item.sequenceNumber}
                            </span>
                          </div>
                        </div>

                        {/* Priority Selector Control */}
                        <div className="flex items-center gap-2">
                          <select
                            value={item.priority || 'NORMAL'}
                            onChange={(e) => handlePrioritySelect(item, e.target.value)}
                            disabled={actionLoading}
                            aria-label={`Change priority for ${item.ticketNumber}`}
                            className="bg-sq-surfaceSecondary text-[10px] font-bold text-sq-textPrimary rounded-lg px-2 py-1 border border-sq-border focus:outline-none focus:border-sq-primary cursor-pointer"
                          >
                            <option value="NORMAL" className="bg-sq-surfaceSecondary">NORMAL</option>
                            <option value="APPOINTMENT" className="bg-sq-surfaceSecondary">APPOINTMENT</option>
                            <option value="PRIORITY" className="bg-sq-surfaceSecondary">PRIORITY</option>
                            <option value="EMERGENCY" className="bg-sq-surfaceSecondary">EMERGENCY</option>
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          </>
        )}

        {/* NO SHOW CONFIRMATION MODAL */}
        <Modal
          isOpen={isNoShowModalOpen}
          onClose={() => setIsNoShowModalOpen(false)}
          title="Mark Customer as No-Show?"
          subtitle={`Ticket ${currentEntry?.ticketNumber || ''}`}
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-red-950/40 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-sq-textSecondary leading-relaxed">
                Are you sure you want to mark token <strong>{currentEntry?.ticketNumber}</strong> as NO_SHOW? This action is terminal and will clear the active counter status so you can call the next customer.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setIsNoShowModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={actionLoading}
                onClick={handleConfirmNoShow}
              >
                Confirm No-Show
              </Button>
            </div>
          </div>
        </Modal>

        {/* EMERGENCY PRIORITY CONFIRMATION MODAL */}
        <Modal
          isOpen={isEmergencyModalOpen}
          onClose={() => setIsEmergencyModalOpen(false)}
          title="Elevate to EMERGENCY Priority?"
          subtitle={`Ticket ${targetEmergencyItem?.ticketNumber || ''}`}
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-red-950/40 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-sq-textSecondary leading-relaxed">
                Are you sure you want to mark token <strong>{targetEmergencyItem?.ticketNumber}</strong> as <strong>EMERGENCY</strong> priority? This customer will immediately move to the top of the call queue ahead of all lower priority tickets.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setIsEmergencyModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={actionLoading}
                onClick={() => applyPriorityChange(targetEmergencyItem?._id || targetEmergencyItem?.id, 'EMERGENCY')}
              >
                Confirm Emergency
              </Button>
            </div>
          </div>
        </Modal>

        {/* QR CHECK-IN SCANNER & VALIDATION MODAL */}
        <QrCheckInModal
          isOpen={isQrCheckInModalOpen}
          onClose={() => setIsQrCheckInModalOpen(false)}
          onSuccessCheckIn={(checkInResult) => {
            setToast({
              type: 'success',
              text: `Customer ticket ${checkInResult?.ticketNumber || ''} checked in successfully!`,
            });
            fetchStaffData(false);
          }}
        />
      </div>
    </MainLayout>
  );
};

export default StaffDashboard;

