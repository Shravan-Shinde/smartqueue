import React, { useState } from 'react';
import {
  Clock,
  Star,
  Timer,
  Send,
} from 'lucide-react';
import Modal from '../../common/Modal';
import Badge from '../../common/Badge';
import Button from '../../common/Button';
import reviewService from '../../../services/reviewService';

const formatSeconds = (totalSec) => {
  if (totalSec === null || totalSec === undefined) return 'N/A';
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins === 0) return `${secs} seconds`;
  return `${mins} min ${secs} sec`;
};

const formatTimestamp = (dateInput) => {
  if (!dateInput) return null;
  return new Date(dateInput).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

/**
 * Detailed Customer Service Record & Interactive Lifecycle Timeline Modal
 * Warm Architectural Palette (#3E362E, #463B32, #AC8968)
 */
const HistoryDetailModal = ({ isOpen, onClose, detail, loading, onReviewSubmitted }) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setErrorMsg('Please select a star rating between 1 and 5');
      return;
    }
    setErrorMsg('');
    setIsSubmittingReview(true);
    try {
      const res = await reviewService.submitReview(detail._id || detail.id, {
        rating,
        comment,
      });
      if (res?.success) {
        setSuccessMsg('Review submitted successfully!');
        if (onReviewSubmitted) onReviewSubmitted(res.data);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to submit review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (loading || !detail) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Service Record Details">
        <div className="p-8 text-center space-y-3">
          <div className="w-8 h-8 mx-auto border-2 border-sq-warning border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-sq-muted">Loading service record timeline...</p>
        </div>
      </Modal>
    );
  }

  const orgName = detail.organizationId?.name || 'SmartQueue Partner';
  const locName = detail.locationId?.name || 'Location';
  const deptName = detail.departmentId?.name || 'Department';
  const queueName = detail.queueId?.name || 'Service Queue';
  const ticketNumber = detail.ticketNumber || 'TICKET';

  const statusVariant =
    detail.status === 'COMPLETED'
      ? 'success'
      : detail.status === 'NO_SHOW'
      ? 'warning'
      : 'danger';

  // Lifecycle Timeline Steps
  const timelineSteps = [
    { label: 'Joined Queue', time: formatTimestamp(detail.joinedAt), active: !!detail.joinedAt },
    { label: 'Checked In', time: formatTimestamp(detail.checkedInAt), active: !!detail.checkedInAt },
    { label: 'Called to Counter', time: formatTimestamp(detail.calledAt), active: !!detail.calledAt },
    { label: 'Service Started', time: formatTimestamp(detail.startedAt), active: !!detail.startedAt },
    detail.status === 'COMPLETED'
      ? { label: 'Service Completed', time: formatTimestamp(detail.completedAt), active: !!detail.completedAt, final: true }
      : detail.status === 'NO_SHOW'
      ? { label: 'Marked No-Show', time: formatTimestamp(detail.noShowAt), active: !!detail.noShowAt, final: true, error: true }
      : { label: 'Queue Entry Cancelled', time: formatTimestamp(detail.cancelledAt), active: !!detail.cancelledAt, final: true, error: true },
  ].filter((step) => step.active || step.final);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Ticket #${ticketNumber}`}
      subtitle={`${queueName} • ${orgName}`}
    >
      <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
        {/* Ticket Header & Status Summary */}
        <div className="p-4 bg-sq-surfaceSecondary rounded-2xl border border-sq-border flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-2xl font-black text-sq-textPrimary">{ticketNumber}</div>
            <p className="text-xs text-sq-textSecondary">
              {locName} • {deptName}
            </p>
          </div>
          <div className="text-right space-y-1">
            <Badge variant={statusVariant} size="md">
              STATUS: {detail.status}
            </Badge>
            {detail.priority && detail.priority !== 'NORMAL' && (
              <div className="pt-0.5">
                <Badge variant="pink" size="sm">
                  {detail.priority} PRIORITY
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Step-by-Step Interactive Lifecycle Timeline */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-sq-textPrimary flex items-center gap-2">
            <Clock className="w-4 h-4 text-sq-textSecondary" />
            <span>Service Lifecycle Timeline</span>
          </h4>

          <div className="p-4 bg-sq-surface rounded-2xl border border-sq-border relative pl-6">
            <div className="absolute left-7 top-6 bottom-6 w-0.5 bg-white/10" />

            <div className="space-y-4 relative">
              {timelineSteps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div
                    className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 mt-0.5 z-10 ${
                      step.error
                        ? 'bg-red-500 border-red-400'
                        : step.active
                        ? 'bg-emerald-400 border-emerald-300'
                        : 'bg-sq-surfaceSecondary border-sq-borderStrong'
                    }`}
                  />
                  <div className="flex-1 flex items-center justify-between text-xs">
                    <span className="font-bold text-sq-textPrimary">{step.label}</span>
                    <span className="text-sq-muted text-[11px]">
                      {step.time || 'N/A'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Duration Metrics Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 bg-sq-surface rounded-2xl border border-sq-border space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sq-muted flex items-center gap-1">
              <Timer className="w-3.5 h-3.5 text-sq-textSecondary" /> Actual Waiting Duration
            </span>
            <div className="text-lg font-bold text-sq-textPrimary">
              {formatSeconds(detail.actualWaitDurationSec)}
            </div>
          </div>

          <div className="p-4 bg-sq-surface rounded-2xl border border-sq-border space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sq-muted flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-emerald-400" /> Actual Service Duration
            </span>
            <div className="text-lg font-bold text-sq-textPrimary">
              {formatSeconds(detail.actualServiceDurationSec)}
            </div>
          </div>
        </div>

        {/* Counter & Staff Attribution */}
        {detail.calledByCounterId && (
          <div className="p-3.5 bg-sq-surfaceSecondary rounded-xl border border-sq-border flex items-center justify-between text-xs">
            <span className="text-sq-textSecondary font-semibold">Service Counter</span>
            <span className="text-sq-textPrimary font-bold">{detail.calledByCounterId.name}</span>
          </div>
        )}

        {/* Customer Review Section */}
        <div className="space-y-3 pt-2 border-t border-sq-border">
          <h4 className="text-xs font-bold uppercase tracking-wider text-sq-textPrimary flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400" />
            <span>Service Rating & Feedback</span>
          </h4>

          {detail.review?.submitted ? (
            <div className="p-4 bg-sq-surfaceSecondary rounded-2xl border border-amber-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-amber-400 font-bold text-sm">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= detail.review.rating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-sq-textPrimary'
                      }`}
                    />
                  ))}
                  <span className="ml-1 text-sq-textPrimary">{detail.review.rating}.0 / 5</span>
                </div>
                <Badge variant="success" size="sm">
                  Submitted
                </Badge>
              </div>

              {detail.review.comment && (
                <p className="text-xs text-sq-textSecondary italic bg-sq-surfaceSecondary p-3 rounded-xl border border-sq-border">
                  "{detail.review.comment}"
                </p>
              )}
            </div>
          ) : detail.status === 'COMPLETED' ? (
            <form
              onSubmit={handleReviewSubmit}
              className="p-4 bg-sq-surface rounded-2xl border border-sq-border space-y-3"
            >
              <div className="flex items-center gap-2 py-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 focus:outline-none"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= (hoverRating || rating)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-sq-textPrimary'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs text-sq-textPrimary font-bold ml-2">
                  {rating > 0 ? `${rating}.0 / 5 Stars` : 'Select rating'}
                </span>
              </div>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 500))}
                placeholder="Share optional feedback on your visit..."
                rows={2}
                className="w-full bg-sq-surfaceSecondary border border-sq-border rounded-xl p-2.5 text-xs text-sq-textPrimary placeholder-[#A69080] focus:outline-none focus:border-sq-warning resize-none"
              />

              {errorMsg && <p className="text-xs text-red-400 font-semibold">{errorMsg}</p>}
              {successMsg && <p className="text-xs text-emerald-400 font-semibold">{successMsg}</p>}

              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmittingReview}
                disabled={rating === 0 || isSubmittingReview}
                icon={Send}
                className="w-full"
              >
                Submit Review
              </Button>
            </form>
          ) : (
            <div className="p-3.5 bg-sq-surfaceSecondary rounded-xl border border-sq-border text-xs text-sq-muted text-center">
              Reviews are available only for completed queue services.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default HistoryDetailModal;
