import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, ChevronLeft, ChevronRight, History } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import Button from '../components/common/Button';
import customerHistoryService from '../services/customerHistoryService';
import HistoryFilters from '../components/customer/history/HistoryFilters';
import HistoryCard from '../components/customer/history/HistoryCard';
import HistoryDetailModal from '../components/customer/history/HistoryDetailModal';

/**
 * SmartQueue Customer History & Service Record Dashboard Page
 * Warm Architectural Palette (#3E362E, #463B32, #AC8968)
 */
const CustomerHistoryPage = () => {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const [filters, setFilters] = useState({
    status: '',
    datePreset: 'ALL',
    dateFrom: '',
    dateTo: '',
    page: 1,
  });

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Detail Modal States
  const [detailData, setDetailData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Fetch History List
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = {
        status: filters.status || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        page: filters.page,
        limit: 10,
      };

      const res = await customerHistoryService.getCustomerHistory(params);
      if (res?.success) {
        setItems(res.data.items || []);
        setPagination(res.data.pagination || {});
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to load service history');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleFilterChange = (newFilters) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      page: 1,
    }));
  };

  const handleResetFilters = () => {
    setFilters({
      status: '',
      datePreset: 'ALL',
      dateFrom: '',
      dateTo: '',
      page: 1,
    });
  };

  const handleViewDetail = async (entryId) => {
    setIsDetailModalOpen(true);
    setLoadingDetail(true);
    try {
      const res = await customerHistoryService.getHistoryDetail(entryId);
      if (res?.success) {
        setDetailData(res.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Unable to fetch record detail');
      setIsDetailModalOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleLeaveReviewTrigger = (item) => {
    handleViewDetail(item._id || item.id);
  };

  const handleReviewSubmittedInModal = (updatedReview) => {
    if (detailData) {
      setDetailData((prev) => ({
        ...prev,
        review: {
          submitted: true,
          rating: updatedReview.rating,
          comment: updatedReview.comment,
          status: updatedReview.status,
        },
      }));
    }
    fetchHistory();
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  return (
    <MainLayout roleTitle="Service History">
      <div className="space-y-6 pb-12 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sq-border pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-sq-surfaceSecondary text-sq-textSecondary flex items-center justify-center font-bold border border-sq-border">
                <History className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-sq-textPrimary tracking-tight">
                My Service History & Visit Records
              </h1>
            </div>
            <p className="text-xs text-sq-muted pl-11">
              Review completed queue visits, service timelines, wait & service durations, and submit ratings.
            </p>
          </div>

          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={fetchHistory}>
            Refresh History
          </Button>
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-950/40 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-medium">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* History Filter Bar */}
        <HistoryFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
        />

        {/* History Items List Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-sq-textPrimary flex items-center gap-2">
              <span>Past Visit Records</span>
              <span className="text-xs font-normal text-sq-muted">
                ({pagination.totalItems || 0} visits)
              </span>
            </h2>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-32 bg-sq-surface rounded-2xl border border-sq-border animate-pulse"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 bg-sq-surface rounded-2xl border border-sq-border text-center space-y-3">
              <History className="w-10 h-10 mx-auto text-sq-muted opacity-50" />
              <h3 className="text-base font-bold text-sq-textPrimary">
                {filters.status || filters.dateFrom || filters.dateTo
                  ? 'No history matches your filters'
                  : 'No service history yet'}
              </h3>
              <p className="text-xs text-sq-muted max-w-md mx-auto">
                {filters.status || filters.dateFrom || filters.dateTo
                  ? 'Try resetting your filter parameters or select a broader time range.'
                  : 'Your completed, cancelled, or no-show queue visits will automatically appear here.'}
              </p>
              {(filters.status || filters.dateFrom || filters.dateTo) && (
                <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <HistoryCard
                  key={item._id || item.id}
                  item={item}
                  onViewDetail={handleViewDetail}
                  onLeaveReview={handleLeaveReviewTrigger}
                />
              ))}
            </div>
          )}

          {/* Server-Side Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 px-1 border-t border-sq-border">
              <span className="text-xs text-sq-muted">
                Page <strong className="text-sq-textPrimary">{pagination.page}</strong> of{' '}
                <strong className="text-sq-textPrimary">{pagination.totalPages}</strong>
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ChevronLeft}
                  disabled={!pagination.hasPreviousPage || loading}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ChevronRight}
                  disabled={!pagination.hasNextPage || loading}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* History Record Detail & Lifecycle Timeline Modal */}
        <HistoryDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          detail={detailData}
          loading={loadingDetail}
          onReviewSubmitted={handleReviewSubmittedInModal}
        />
      </div>
    </MainLayout>
  );
};

export default CustomerHistoryPage;
