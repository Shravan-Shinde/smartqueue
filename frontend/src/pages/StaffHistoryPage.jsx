import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Filter,
  Calendar,
  CheckCircle2,
  UserX,
  XCircle,
  Activity,
  Layers,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Info,
  Search,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Toast from '../components/common/Toast';
import SkeletonLoader from '../components/common/SkeletonLoader';
import EmptyState from '../components/common/EmptyState';

import staffService from '../services/staffService';
import socketService from '../services/socketService';

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 */
const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined) return '—';
  const total = Math.max(0, parseInt(seconds, 10));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hrs > 0) {
    return `${hrs}h ${String(mins).padStart(2, '0')}m`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/**
 * Format ISO Date string to readable time format (e.g. 02:45 PM)
 */
const formatTime = (isoString) => {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (err) {
    return '—';
  }
};

/**
 * SmartQueue Staff Operational History & Summary Page
 */
const StaffHistoryPage = () => {
  const [historyData, setHistoryData] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, totalPages: 1, totalRecords: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Filters State
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Detail Modal State
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Fetch History List
  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await staffService.getStaffHistory({
        page: currentPage,
        limit: 20,
        status: selectedStatus,
        date: selectedDate,
      });

      if (res && res.data) {
        setHistoryData(res.data || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      }
    } catch (err) {
      setToast({ type: 'error', text: err.message || 'Failed to load staff history.' });
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, selectedStatus, selectedDate]);

  // Fetch Summary Metrics
  const fetchSummary = useCallback(async () => {
    setIsSummaryLoading(true);
    try {
      const res = await staffService.getStaffHistorySummary({ date: selectedDate });
      if (res && res.data) {
        setSummaryData(res.data);
      }
    } catch (err) {
      console.warn('[STAFF HISTORY] Summary load error:', err.message);
    } finally {
      setIsSummaryLoading(false);
    }
  }, [selectedDate]);

  // Initial load & Socket Listeners
  useEffect(() => {
    fetchHistory();
    fetchSummary();
  }, [fetchHistory, fetchSummary]);

  useEffect(() => {
    socketService.connectSocket();

    const unsubUpdated = socketService.onQueueUpdated(() => {
      fetchHistory();
      fetchSummary();
    });

    return () => {
      unsubUpdated();
    };
  }, [fetchHistory, fetchSummary]);

  // Filter change handlers
  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusChange = (e) => {
    setSelectedStatus(e.target.value);
    setCurrentPage(1);
  };

  const handleOpenDetail = (entry) => {
    setSelectedEntry(entry);
    setIsDetailModalOpen(true);
  };

  return (
    <MainLayout roleTitle="Staff History & Metrics">
      <div className="space-y-6 max-w-7xl mx-auto">
        {toast && <Toast type={toast.type} message={toast.text} onClose={() => setToast(null)} />}

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-sq-surface p-6 rounded-2xl border border-sq-border shadow-xl">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-sq-textPrimary flex items-center gap-2.5">
              <Clock className="w-6 h-6 text-sq-primary" /> Staff Service History
            </h1>
            <p className="text-xs text-sq-textSecondary mt-1">
              Review completed customer interactions, service duration logs, no-shows, and daily metrics.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                fetchHistory();
                fetchSummary();
              }}
              className="px-3.5 py-2 bg-sq-bg hover:bg-sq-surfaceSecondary text-sq-textSecondary hover:text-sq-textPrimary rounded-xl text-xs font-semibold border border-sq-border flex items-center gap-2 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Log
            </button>
          </div>
        </div>

        {/* Daily Summary Cards Section */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card variant="surface" className="text-center p-4">
            <span className="text-[10px] font-bold text-sq-muted uppercase tracking-wider block">
              Total Handled
            </span>
            <div className="text-2xl font-black text-sq-textPrimary mt-1">
              {isSummaryLoading ? '—' : summaryData?.totalHandled ?? 0}
            </div>
          </Card>

          <Card variant="surface" className="text-center p-4 border-l-2 border-l-emerald-400">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
              Completed
            </span>
            <div className="text-2xl font-black text-sq-textPrimary mt-1">
              {isSummaryLoading ? '—' : summaryData?.completed ?? 0}
            </div>
          </Card>

          <Card variant="surface" className="text-center p-4 border-l-2 border-l-red-400">
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block">
              No-Show
            </span>
            <div className="text-2xl font-black text-sq-textPrimary mt-1">
              {isSummaryLoading ? '—' : summaryData?.noShow ?? 0}
            </div>
          </Card>

          <Card variant="surface" className="text-center p-4 border-l-2 border-l-amber-400">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
              Cancelled
            </span>
            <div className="text-2xl font-black text-sq-textPrimary mt-1">
              {isSummaryLoading ? '—' : summaryData?.cancelled ?? 0}
            </div>
          </Card>

          <Card variant="surface" className="text-center p-4 border-l-2 border-l-[#287D91]">
            <span className="text-[10px] font-bold text-sq-info uppercase tracking-wider block">
              Avg Service Time
            </span>
            <div className="text-xl font-mono font-bold text-sq-info mt-1">
              {isSummaryLoading ? '—' : formatDuration(summaryData?.averageServiceDurationSeconds)}
            </div>
          </Card>

          <Card variant="surface" className="text-center p-4 border-l-2 border-l-[#B27BDD]">
            <span className="text-[10px] font-bold text-sq-info uppercase tracking-wider block">
              Avg Wait Time
            </span>
            <div className="text-xl font-mono font-bold text-sq-info mt-1">
              {isSummaryLoading ? '—' : formatDuration(summaryData?.averageWaitDurationSeconds)}
            </div>
          </Card>
        </div>

        {/* Filters Toolbar */}
        <Card variant="surface" className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            {/* Date Selector */}
            <div className="flex items-center gap-2 bg-sq-bg px-3 py-2 rounded-xl border border-sq-border w-full sm:w-auto">
              <Calendar className="w-4 h-4 text-sq-primary" />
              <span className="text-xs font-semibold text-sq-muted">Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                className="bg-transparent text-xs font-semibold text-sq-textPrimary focus:outline-none cursor-pointer"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2 bg-sq-bg px-3 py-2 rounded-xl border border-sq-border w-full sm:w-auto">
              <Filter className="w-4 h-4 text-sq-info" />
              <span className="text-xs font-semibold text-sq-muted">Status:</span>
              <select
                value={selectedStatus}
                onChange={handleStatusChange}
                className="bg-transparent text-xs font-semibold text-sq-textPrimary focus:outline-none cursor-pointer pr-2"
              >
                <option value="ALL" className="-sq-surface-sq-textPrimary">All Statuses</option>
                <option value="COMPLETED" className="-sq-surface-sq-textPrimary">Completed</option>
                <option value="NO_SHOW" className="-sq-surface-sq-textPrimary">No-Show</option>
                <option value="CANCELLED" className="-sq-surface-sq-textPrimary">Cancelled</option>
                <option value="SERVING" className="-sq-surface-sq-textPrimary">Serving</option>
                <option value="CALLED" className="-sq-surface-sq-textPrimary">Called</option>
              </select>
            </div>
          </div>

          <div className="text-xs text-sq-muted font-semibold self-end md:self-center">
            Showing {historyData.length} of {pagination.totalRecords} records
          </div>
        </Card>

        {/* History Table / Responsive Cards */}
        <Card variant="surface" className="overflow-hidden p-0">
          {isLoading ? (
            <div className="p-6">
              <SkeletonLoader variant="card" count={4} />
            </div>
          ) : historyData.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No History Records Found"
              description="No customer operational entries match your current date and status filters."
              actionLabel="Reset Filters"
              onAction={() => {
                setSelectedDate('');
                setSelectedStatus('ALL');
              }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-sq-bg border-b border-sq-border text-[10px] font-bold text-sq-muted uppercase tracking-wider">
                    <th className="py-3.5 px-6">Ticket Number</th>
                    <th className="py-3.5 px-4">Queue / Department</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Called Time</th>
                    <th className="py-3.5 px-4">Service Time</th>
                    <th className="py-3.5 px-4">Wait Time</th>
                    <th className="py-3.5 px-6 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-sq-textPrimary">
                  {historyData.map((item) => (
                    <tr
                      key={item.id || item._id}
                      onClick={() => handleOpenDetail(item)}
                      className="hover:bg-sq-surfaceSecondary cursor-pointer transition-colors"
                    >
                      <td className="py-4 px-6 font-bold text-sq-primary font-mono">
                        {item.ticketNumber}
                      </td>
                      <td className="py-4 px-4 font-semibold text-sq-textSecondary">
                        {item.queueName || 'Queue'}
                      </td>
                      <td className="py-4 px-4">
                        <Badge
                          variant={
                            item.status === 'COMPLETED'
                              ? 'success'
                              : item.status === 'NO_SHOW'
                              ? 'danger'
                              : item.status === 'CANCELLED'
                              ? 'warning'
                              : item.status === 'SERVING'
                              ? 'pink'
                              : 'secondary'
                          }
                          size="sm"
                          dot
                        >
                          {item.status}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 font-mono text-sq-textSecondary">
                        {formatTime(item.calledAt || item.joinedAt)}
                      </td>
                      <td className="py-4 px-4 font-mono font-semibold text-sq-info">
                        {formatDuration(item.serviceDurationSeconds)}
                      </td>
                      <td className="py-4 px-4 font-mono font-semibold text-sq-info">
                        {formatDuration(item.waitDurationSeconds)}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button className="p-1.5 text-sq-muted hover:text-sq-textPrimary rounded-lg hover:bg-sq-surfaceSecondary">
                          <Info className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 bg-sq-bg border-t border-sq-border">
              <Button
                variant="secondary"
                size="sm"
                icon={ChevronLeft}
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </Button>

              <span className="text-xs font-semibold text-sq-textSecondary">
                Page <strong className="text-sq-textPrimary">{pagination.page}</strong> of{' '}
                <strong className="text-sq-textPrimary">{pagination.totalPages}</strong>
              </span>

              <Button
                variant="secondary"
                size="sm"
                icon={ChevronRight}
                disabled={currentPage >= pagination.totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </Card>

        {/* TICKET DETAIL DRAWER / MODAL */}
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Ticket Operational Timeline`}
          subtitle={selectedEntry?.ticketNumber || 'Token Detail'}
        >
          {selectedEntry && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-sq-surfaceSecondary rounded-xl border border-sq-border">
                <div>
                  <span className="text-[10px] text-sq-muted uppercase font-bold tracking-wider">
                    Ticket Number
                  </span>
                  <div className="text-3xl font-black text-sq-primary tracking-tight">
                    {selectedEntry.ticketNumber}
                  </div>
                </div>
                <Badge
                  variant={
                    selectedEntry.status === 'COMPLETED'
                      ? 'success'
                      : selectedEntry.status === 'NO_SHOW'
                      ? 'danger'
                      : 'secondary'
                  }
                  size="md"
                  dot
                >
                  {selectedEntry.status}
                </Badge>
              </div>

              {/* Operational Timeline Grid */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-sq-muted">
                  Operational Milestones
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-sq-surfaceSecondary rounded-xl border border-sq-border">
                    <span className="text-[10px] text-sq-muted block font-semibold">Customer Joined</span>
                    <span className="font-mono text-sq-textPrimary font-semibold">{formatTime(selectedEntry.joinedAt)}</span>
                  </div>
                  <div className="p-3 bg-sq-surfaceSecondary rounded-xl border border-sq-border">
                    <span className="text-[10px] text-sq-muted block font-semibold">Counter Called</span>
                    <span className="font-mono text-sq-textPrimary font-semibold">{formatTime(selectedEntry.calledAt)}</span>
                  </div>
                  <div className="p-3 bg-sq-surfaceSecondary rounded-xl border border-sq-border">
                    <span className="text-[10px] text-sq-muted block font-semibold">Service Started</span>
                    <span className="font-mono text-sq-textPrimary font-semibold">{formatTime(selectedEntry.startedAt)}</span>
                  </div>
                  <div className="p-3 bg-sq-surfaceSecondary rounded-xl border border-sq-border">
                    <span className="text-[10px] text-sq-muted block font-semibold">
                      {selectedEntry.status === 'NO_SHOW' ? 'Marked No-Show' : 'Service Completed'}
                    </span>
                    <span className="font-mono text-sq-textPrimary font-semibold">
                      {formatTime(selectedEntry.completedAt || selectedEntry.noShowAt || selectedEntry.cancelledAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Service & Wait Durations */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-sq-surfaceSecondary rounded-xl border border-sq-border text-center">
                  <span className="text-[10px] font-bold text-sq-info uppercase tracking-wider block">
                    Service Duration
                  </span>
                  <span className="text-xl font-mono font-bold text-sq-textPrimary mt-1 block">
                    {formatDuration(selectedEntry.serviceDurationSeconds)}
                  </span>
                </div>
                <div className="p-4 bg-sq-surfaceSecondary rounded-xl border border-sq-border text-center">
                  <span className="text-[10px] font-bold text-sq-info uppercase tracking-wider block">
                    Wait Duration
                  </span>
                  <span className="text-xl font-mono font-bold text-sq-textPrimary mt-1 block">
                    {formatDuration(selectedEntry.waitDurationSeconds)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="secondary" size="sm" onClick={() => setIsDetailModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </MainLayout>
  );
};

export default StaffHistoryPage;
