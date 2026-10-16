import React, { useState, useEffect, useCallback } from 'react';
import { Star, RefreshCw, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import Button from '../components/common/Button';
import reviewService from '../services/reviewService';
import ReviewSummaryPanel from '../components/admin/reviews/ReviewSummaryPanel';
import ReviewFilters from '../components/admin/reviews/ReviewFilters';
import ReviewTable from '../components/admin/reviews/ReviewTable';

/**
 * Admin Customer Reviews & Service Feedback Management Page
 */
const AdminReviewPage = () => {
  const [summary, setSummary] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const [filters, setFilters] = useState({
    rating: '',
    status: '',
    organizationId: '',
    locationId: '',
    departmentId: '',
    queueId: '',
    datePreset: 'ALL',
    startDate: '',
    endDate: '',
    page: 1,
  });

  // Fetch summary metrics
  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const params = {
        organizationId: filters.organizationId || undefined,
        locationId: filters.locationId || undefined,
        departmentId: filters.departmentId || undefined,
        queueId: filters.queueId || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      };
      const res = await reviewService.getAdminReviewSummary(params);
      if (res?.success) {
        setSummary(res.data);
      }
    } catch (err) {
      console.error('[ADMIN REVIEWS] Summary fetch error:', err);
    } finally {
      setLoadingSummary(false);
    }
  }, [filters]);

  // Fetch reviews list
  const fetchReviews = useCallback(async () => {
    setLoadingReviews(true);
    setErrorMsg(null);
    try {
      const params = {
        rating: filters.rating || undefined,
        status: filters.status || undefined,
        organizationId: filters.organizationId || undefined,
        locationId: filters.locationId || undefined,
        departmentId: filters.departmentId || undefined,
        queueId: filters.queueId || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        page: filters.page,
        limit: 10,
      };

      const res = await reviewService.getAdminReviews(params);
      if (res?.success) {
        setReviews(res.data || []);
        setPagination(res.pagination || { page: 1, limit: 10, total: 0, pages: 1 });
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to fetch customer reviews');
    } finally {
      setLoadingReviews(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchSummary();
    fetchReviews();
  }, [fetchSummary, fetchReviews]);

  const handleFilterChange = (newFilters) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      page: 1, // Reset page on filter change
    }));
  };

  const handleResetFilters = () => {
    setFilters({
      rating: '',
      status: '',
      organizationId: '',
      locationId: '',
      departmentId: '',
      queueId: '',
      datePreset: 'ALL',
      startDate: '',
      endDate: '',
      page: 1,
    });
  };

  const handleToggleStatus = async (reviewId, newStatus) => {
    try {
      const res = await reviewService.updateReviewStatus(reviewId, newStatus);
      if (res?.success) {
        // Optimistically update local review status
        setReviews((prev) =>
          prev.map((r) => ((r._id || r.id) === reviewId ? { ...r, status: newStatus } : r))
        );
        fetchSummary();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update review status');
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.pages) return;
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const handleRefresh = () => {
    fetchSummary();
    fetchReviews();
  };

  return (
    <MainLayout roleTitle="Customer Reviews">
      <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sq-border pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sq-surfaceSecondary text-amber-400 flex items-center justify-center font-bold">
              <Star className="w-4 h-4 fill-amber-400" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Customer Reviews & Service Feedback
            </h1>
          </div>
          <p className="text-xs text-sq-textSecondary pl-10">
            Monitor customer satisfaction scores, service comments, rating distributions, and moderate review visibility.
          </p>
        </div>

        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={handleRefresh}>
          Refresh Reviews
        </Button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-950/40 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-medium">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Rating Summary Panel */}
      <ReviewSummaryPanel summary={summary} loading={loadingSummary} />

      {/* Filters Section */}
      <ReviewFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* Reviews List Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span>All Submitted Customer Reviews</span>
            <span className="text-xs font-normal text-sq-textSecondary">
              ({pagination.total || 0} total)
            </span>
          </h2>
        </div>

        <ReviewTable
          reviews={reviews}
          loading={loadingReviews}
          onToggleStatus={handleToggleStatus}
        />

        {/* Pagination Controls */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between pt-2 px-1">
            <span className="text-xs text-sq-textSecondary">
              Page <strong className="text-white">{pagination.page}</strong> of{' '}
              <strong className="text-white">{pagination.pages}</strong>
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={ChevronLeft}
                disabled={pagination.page <= 1 || loadingReviews}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={ChevronRight}
                disabled={pagination.page >= pagination.pages || loadingReviews}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
    </MainLayout>
  );
};

export default AdminReviewPage;
