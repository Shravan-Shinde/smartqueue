import React, { useState, useEffect } from 'react';
import { Building2, MapPin, Ticket, Clock, XCircle, AlertTriangle, QrCode, RefreshCw, CheckCircle2, Star, Send } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Card from './common/Card';
import Badge from './common/Badge';
import Button from './common/Button';
import Modal from './common/Modal';
import queueService from '../services/queueService';
import reviewService from '../services/reviewService';

/**
 * Customer Post-Service Feedback & Star Rating Sub-Component
 * Warm Architectural Palette (#3E362E, #463B32, #AC8968)
 */
const ReviewSection = ({ entryId }) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingReview, setExistingReview] = useState(null);
  const [loadingReview, setLoadingReview] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchExistingReview = async () => {
      if (!entryId) {
        setLoadingReview(false);
        return;
      }
      try {
        const res = await reviewService.getEntryReview(entryId);
        if (isMounted && res?.success && res.data) {
          setExistingReview(res.data);
        }
      } catch (err) {
        // No review submitted yet
      } finally {
        if (isMounted) setLoadingReview(false);
      }
    };
    fetchExistingReview();
    return () => {
      isMounted = false;
    };
  }, [entryId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setErrorMsg('Please select a rating between 1 and 5 stars');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const res = await reviewService.submitReview(entryId, { rating, comment });
      if (res?.success) {
        setExistingReview(res.data);
        setSuccessMsg('Thank you! Your feedback has been submitted.');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingReview) {
    return (
      <div className="p-4 bg-sq-surfaceSecondary rounded-2xl border border-sq-border text-center text-xs text-sq-muted">
        Checking review status...
      </div>
    );
  }

  if (existingReview) {
    return (
      <div className="p-4 bg-sq-surfaceSecondary rounded-2xl border border-sq-warning space-y-2 text-left">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-sq-warning uppercase tracking-wider flex items-center gap-1.5">
            <Star className="w-4 h-4 fill-[#E6A15C] text-sq-warning" />
            Your Rating: {existingReview.rating}.0 / 5
          </span>
          <Badge variant="success" size="sm">Review Submitted</Badge>
        </div>
        {existingReview.comment && (
          <p className="text-xs text-sq-textSecondary italic bg-sq-surfaceSecondary p-3 rounded-xl border border-sq-border">
            "{existingReview.comment}"
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-5 bg-sq-surfaceSecondary rounded-2xl border border-sq-border space-y-4 text-left">
      <div className="space-y-1">
        <h4 className="text-sm font-bold text-sq-textPrimary flex items-center gap-2">
          <Star className="w-4 h-4 text-sq-primary" /> How was your service experience?
        </h4>
        <p className="text-xs text-sq-textSecondary">Rate your service to help us improve operations.</p>
      </div>

      {/* Star Rating Buttons */}
      <div className="flex items-center gap-1.5 py-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= (hoverRating || rating);
          return (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1 rounded-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-sq-primary"
              aria-label={`Rate ${star} out of 5 stars`}
            >
              <Star
                className={`w-7 h-7 transition-colors ${
                  isFilled ? 'fill-[#E6A15C] text-sq-warning' : 'text-sq-textPrimary'
                }`}
              />
            </button>
          );
        })}
        <span className="ml-2 text-xs font-bold text-sq-textPrimary">
          {rating > 0 ? `${rating}.0 / 5 Stars` : 'Select rating'}
        </span>
      </div>

      {/* Comment Field */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-sq-muted">
          <span>Optional Comment</span>
          <span>{comment.length}/500</span>
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 500))}
          placeholder="Share details about your wait time, staff service, or counter experience..."
          rows={3}
          className="w-full bg-sq-surfaceSecondary border border-sq-border rounded-xl p-3 text-xs text-sq-textPrimary placeholder-sq-muted focus:outline-none focus:border-sq-primary resize-none"
        />
      </div>

      {errorMsg && <p className="text-xs text-sq-danger font-semibold">{errorMsg}</p>}
      {successMsg && <p className="text-xs text-sq-primary font-semibold">{successMsg}</p>}

      <Button
        type="submit"
        variant="primary"
        size="sm"
        isLoading={isSubmitting}
        disabled={rating === 0 || isSubmitting}
        icon={Send}
        className="w-full"
      >
        Submit Review
      </Button>
    </form>
  );
};

/**
 * SmartQueue Customer Digital Token Card Component
 * Warm Architectural Palette (#3E362E, #463B32, #AC8968)
 */
const DigitalTokenCard = ({ entry, position, peopleAhead, onCancel, connectionState = 'CONNECTED' }) => {
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // QR Token State
  const [qrToken, setQrToken] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(null);

  const entryId = entry?._id || entry?.id;
  const isEligible = entry && ['WAITING', 'CALLED', 'SERVING'].includes(entry.status);

  const fetchQrToken = async () => {
    if (!entryId || !isEligible) return;
    setQrLoading(true);
    setQrError(null);
    try {
      const response = await queueService.getEntryQrToken(entryId);
      if (response?.success && response.data?.qrToken) {
        setQrToken(response.data.qrToken);
      } else {
        setQrError('Unable to load QR token');
      }
    } catch (err) {
      setQrError(err.response?.data?.message || err.message || 'Unable to load QR code');
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => {
    if (isEligible && entryId) {
      fetchQrToken();
    }
  }, [entryId, entry?.status]);

  if (!entry) return null;

  const handleConfirmCancel = async () => {
    setIsCancelling(true);
    try {
      if (onCancel) {
        await onCancel(entry._id || entry.id);
      }
    } finally {
      setIsCancelling(false);
      setIsCancelModalOpen(false);
    }
  };

  const formattedJoinedTime = entry.joinedAt
    ? new Date(entry.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Just now';

  const orgName = entry.organizationId?.name || 'SmartQueue Partner';
  const locName = entry.locationId?.name || 'Main Location';
  const deptName = entry.departmentId?.name || entry.queueName || 'Service Department';
  const queueName = entry.queueId?.name || 'General Service Queue';
  const ticketNumber = entry.ticketNumber || 'TOKEN-000';

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* Header Info */}
      <Card variant="surface" className="bg-sq-surface p-5 space-y-3 border-l-4 border-l-[#8FAF6F] shadow-lg shadow-black/40">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-sq-primarySubtle text-sq-primary flex items-center justify-center font-bold shrink-0 border border-sq-borderStrong">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-sq-textPrimary">{orgName}</h3>
            <p className="text-xs text-sq-textSecondary flex items-center gap-1.5 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-sq-primary" />
              {locName} • {deptName}
            </p>
          </div>
        </div>
      </Card>

      {/* Main Digital Token Card */}
      <Card
        variant="elevated"
        className="bg-sq-surface p-6 text-center space-y-6 border-2 border-sq-borderStrong relative overflow-hidden shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-sq-border pb-4">
          <div className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-sq-primary" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-sq-textPrimary">
              Digital Ticket Token
            </span>
          </div>
          <div className="flex items-center gap-2">
            {entry.priority && (
              <Badge
                variant={
                  entry.priority === 'EMERGENCY'
                    ? 'danger'
                    : entry.priority === 'PRIORITY'
                    ? 'sage'
                    : entry.priority === 'APPOINTMENT'
                    ? 'warning'
                    : 'secondary'
                }
                size="sm"
              >
                {entry.priority}
              </Badge>
            )}
            {entry.checkedInAt && (
              <Badge variant="success" size="sm" dot font-bold>
                ✓ Checked in
              </Badge>
            )}
            <Badge variant="sage" size="sm" dot font-bold>
              STATUS: {entry.status}
            </Badge>
          </div>
        </div>

        {/* Ticket Number Display */}
        <div className="py-4 space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-sq-primary">
            {queueName}
          </span>
          <div className="text-6xl font-black text-sq-primary tracking-tight py-1 drop-shadow-md">
            {ticketNumber}
          </div>
          <p className="text-xs text-sq-muted">
            Sequence #{entry.sequenceNumber || 1}
          </p>
        </div>

        {/* Secure QR Token Display */}
        {isEligible ? (
          <div className="p-5 bg-sq-surfaceSecondary rounded-2xl border border-sq-border space-y-3 flex flex-col items-center justify-center">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sq-textPrimary mb-1">
              <QrCode className="w-4 h-4 text-sq-primary" />
              <span>Digital Check-In QR</span>
            </div>

            {qrLoading ? (
              <div className="w-44 h-44 rounded-2xl bg-sq-surfaceSecondary flex flex-col items-center justify-center text-sq-muted space-y-2 animate-pulse">
                <RefreshCw className="w-6 h-6 animate-spin text-sq-primary" />
                <span className="text-[11px]">Loading QR token...</span>
              </div>
            ) : qrError ? (
              <div className="w-full p-4 bg-sq-dangerBg border border-sq-danger rounded-xl space-y-2 text-center">
                <p className="text-xs text-sq-danger font-semibold">{qrError}</p>
                <Button variant="secondary" size="sm" icon={RefreshCw} onClick={fetchQrToken}>
                  Retry QR Load
                </Button>
              </div>
            ) : qrToken ? (
              <div className="space-y-2 flex flex-col items-center">
                <div className="p-3 bg-white rounded-2xl inline-block shadow-lg border border-sq-borderStrong">
                  <QRCodeSVG
                    value={qrToken}
                    size={170}
                    bgColor="#FFFFFF"
                    fgColor="#171821"
                    level="H"
                    includeMargin={false}
                    aria-label={`SmartQueue QR code for ticket ${ticketNumber}`}
                  />
                </div>
                <p className="text-xs font-semibold text-sq-primary">
                  Show this QR at the counter for check-in
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="p-4 bg-sq-surfaceSecondary rounded-2xl border border-sq-border text-center text-xs text-sq-muted">
            <QrCode className="w-5 h-5 mx-auto mb-1 opacity-40 text-sq-muted" />
            <span>QR ticket unavailable for {entry.status} queue entries</span>
          </div>
        )}

        {/* Checked-In Status Banner */}
        {entry.checkedInAt && (
          <div className="p-3 bg-sq-primarySubtle border border-sq-borderStrong rounded-2xl flex items-center justify-center gap-2 text-sq-primary text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-sq-primary" />
            <span>
              Checked in at{' '}
              {new Date(entry.checkedInAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}

        {/* Status Banner / Guidance */}
        {entry.status === 'CALLED' && (
          <div className="p-4 bg-sq-primarySubtle border border-sq-primary rounded-2xl animate-pulse text-center space-y-1">
            <span className="text-xs font-black uppercase tracking-wider text-sq-primary">
              🔔 YOUR TURN NOW!
            </span>
            <p className="text-sm font-bold text-sq-textPrimary">
              Please proceed to {entry.counterName || 'the assigned counter'} immediately.
            </p>
          </div>
        )}

        {entry.status === 'SERVING' && (
          <div className="p-4 bg-sq-primarySubtle border border-sq-borderStrong rounded-2xl text-center space-y-1">
            <span className="text-xs font-black uppercase tracking-wider text-sq-primary">
              ⚡ SERVICE IN PROGRESS
            </span>
            <p className="text-xs text-sq-textSecondary">
              Your service is currently underway at {entry.counterName || 'the counter'}.
            </p>
          </div>
        )}

        {entry.status === 'COMPLETED' && (
          <div className="space-y-4">
            <div className="p-4 bg-sq-surfaceSecondary border border-sq-borderStrong rounded-2xl text-center space-y-1">
              <span className="text-xs font-black uppercase tracking-wider text-sq-primary">
                ✅ SERVICE COMPLETED
              </span>
              <p className="text-xs text-sq-textSecondary">
                Thank you for visiting! Your service has been completed.
              </p>
            </div>
            <ReviewSection entryId={entryId} />
          </div>
        )}

        {entry.status === 'NO_SHOW' && (
          <div className="p-4 bg-sq-dangerBg border border-sq-danger rounded-2xl text-center space-y-1">
            <span className="text-xs font-black uppercase tracking-wider text-sq-danger">
              ⚠️ MARKED AS NO-SHOW
            </span>
            <p className="text-xs text-sq-textSecondary">
              Your token was called but marked as no-show. Please speak to staff if you need assistance.
            </p>
          </div>
        )}

        {/* Position & People Ahead Breakdown */}
        {entry.status === 'WAITING' ? (
          <div className="p-4 bg-sq-surfaceSecondary rounded-2xl border border-sq-border space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-sq-muted">Queue Position</span>
                <div className="text-2xl font-extrabold text-sq-textPrimary">#{position || 1}</div>
              </div>
              <div className="space-y-1 border-x border-sq-border">
                <span className="text-[10px] uppercase font-bold text-sq-muted">People Ahead</span>
                <div className="text-2xl font-extrabold text-sq-primary">{peopleAhead ?? 0}</div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-sq-muted">Joined At</span>
                <div className="text-xs font-bold text-sq-textSecondary pt-1">{formattedJoinedTime}</div>
              </div>
            </div>

            {/* Smart Wait-Time Engine Display */}
            <div className="pt-2 border-t border-sq-border flex items-center justify-between px-2">
              <div className="text-left">
                <span className="text-[10px] uppercase font-bold text-sq-muted block">Estimated Wait</span>
                <span className="text-lg font-black text-sq-primary">
                  {entry.waitTime?.formattedWaitTime || (peopleAhead === 0 ? 'Under 1 min' : `~${(peopleAhead || 1) * 5} min`)}
                </span>
              </div>

              {entry.waitTime?.estimateQuality && (
                <Badge
                  variant={
                    entry.waitTime.estimateQuality === 'HIGH'
                      ? 'success'
                      : entry.waitTime.estimateQuality === 'MEDIUM'
                      ? 'warning'
                      : 'secondary'
                  }
                  size="sm"
                >
                  Estimate: {entry.waitTime.estimateQuality}
                </Badge>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-sq-surfaceSecondary rounded-2xl border border-sq-border text-center flex items-center justify-around text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-sq-muted">Joined At</span>
              <div className="font-bold text-sq-textSecondary">{formattedJoinedTime}</div>
            </div>
            <div className="border-l border-sq-border pl-4">
              <span className="text-[10px] uppercase font-bold text-sq-muted">Current Status</span>
              <div className="font-bold text-sq-textPrimary">{entry.status}</div>
            </div>
          </div>
        )}

        {/* Status Indicator & Cancel Action */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {connectionState === 'CONNECTED' ? (
              <Badge variant="success" size="sm" dot font-bold>LIVE</Badge>
            ) : connectionState === 'RECONNECTING' ? (
              <Badge variant="warning" size="sm" dot font-bold>RECONNECTING...</Badge>
            ) : (
              <Badge variant="secondary" size="sm">OFFLINE</Badge>
            )}
            <span className="text-[11px] text-sq-muted flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-sq-primary" /> Queue status updated
            </span>
          </div>

          {entry.status === 'WAITING' && (
            <Button
              variant="danger"
              size="sm"
              icon={XCircle}
              onClick={() => setIsCancelModalOpen(true)}
            >
              Cancel Queue Entry
            </Button>
          )}
        </div>
      </Card>

      {/* CANCEL CONFIRMATION MODAL */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancel Queue Entry?"
        subtitle={`Ticket #${ticketNumber} — ${queueName}`}
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-red-950/40 border border-red-500/20 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-sq-textSecondary leading-relaxed">
              Are you sure you want to cancel your place in this queue? You will lose your ticket position ({ticketNumber}) and will need to rejoin.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setIsCancelModalOpen(false)}>
              Keep My Place
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isCancelling}
              onClick={handleConfirmCancel}
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DigitalTokenCard;
