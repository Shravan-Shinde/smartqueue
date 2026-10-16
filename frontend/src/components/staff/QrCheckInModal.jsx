import React, { useState, useEffect, useRef } from 'react';
import { QrCode, Camera, Keyboard, CheckCircle2, AlertTriangle, RefreshCw, XCircle, ShieldAlert } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import Badge from '../common/Badge';
import staffService from '../../services/staffService';

/**
 * SmartQueue Staff QR Check-In & Validation Scanner Modal
 */
const QrCheckInModal = ({ isOpen, onClose, onSuccessCheckIn }) => {
  const [scanMode, setScanMode] = useState('camera'); // 'camera' | 'manual'
  const [manualToken, setManualToken] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error' | 'warning' | 'conflict', message: '', data?: any }
  const [cameraState, setCameraState] = useState('idle'); // 'idle' | 'starting' | 'scanning' | 'denied' | 'unavailable' | 'stopped'

  const html5QrcodeRef = useRef(null);
  const isScanningRef = useRef(false);

  // Stop camera helper
  const stopCamera = async () => {
    if (html5QrcodeRef.current && isScanningRef.current) {
      try {
        await html5QrcodeRef.current.stop();
        html5QrcodeRef.current.clear();
      } catch (err) {
        console.warn('[QR SCANNER] Error stopping camera:', err);
      } finally {
        isScanningRef.current = false;
        html5QrcodeRef.current = null;
        setCameraState('stopped');
      }
    }
  };

  // Start camera scanner
  const startCamera = async () => {
    setFeedback(null);
    setCameraState('starting');

    // Ensure previous camera instance is stopped
    await stopCamera();

    try {
      const html5Qrcode = new Html5Qrcode('qr-reader-viewport');
      html5QrcodeRef.current = html5Qrcode;

      const config = { fps: 10, qrbox: { width: 220, height: 220 } };

      await html5Qrcode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          // QR code detected
          handleTokenSubmitted(decodedText);
        },
        (errorMessage) => {
          // Non-fatal frame scan failure (ignore)
        }
      );

      isScanningRef.current = true;
      setCameraState('scanning');
    } catch (err) {
      console.warn('[QR SCANNER] Camera initialization error:', err);
      isScanningRef.current = false;
      const errStr = String(err).toLowerCase();
      if (errStr.includes('notallowed') || errStr.includes('permission')) {
        setCameraState('denied');
      } else {
        setCameraState('unavailable');
      }
    }
  };

  // Handle modal open/close & mode changes
  useEffect(() => {
    if (isOpen && scanMode === 'camera') {
      // Delay slightly to let DOM element mount
      const timer = setTimeout(() => {
        startCamera();
      }, 200);
      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
    }
  }, [isOpen, scanMode]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Submit token to backend
  const handleTokenSubmitted = async (tokenStr) => {
    if (isProcessing) return;

    const trimmed = (tokenStr || '').trim();
    if (!trimmed) {
      setFeedback({ type: 'error', message: 'Please enter a valid QR token.' });
      return;
    }

    setIsProcessing(true);
    setFeedback({ type: 'info', message: 'Validating ticket...' });

    // Pause scanner if scanning
    if (html5QrcodeRef.current && isScanningRef.current) {
      try {
        await html5QrcodeRef.current.pause(true);
      } catch (e) {
        // ignore pause failure
      }
    }

    try {
      const response = await staffService.checkInWithQrToken(trimmed);
      if (response && response.success) {
        const data = response.data || {};
        const successMsg = response.message || `Customer ticket ${data.ticketNumber || ''} checked in successfully!`;

        setFeedback({
          type: 'success',
          message: successMsg,
          data,
        });

        // Stop camera after successful scan
        await stopCamera();

        if (onSuccessCheckIn) {
          onSuccessCheckIn(data);
        }
      }
    } catch (err) {
      const status = err.response?.status;
      const errData = err.response?.data || {};
      const errMsg = errData.message || errData.error?.message || 'Unable to check in. Please try again.';

      if (status === 409) {
        // Already checked in
        setFeedback({
          type: 'conflict',
          message: errMsg,
          data: errData.data || null,
        });
      } else if (status === 403) {
        // Forbidden / Unauthorized for staff
        setFeedback({
          type: 'forbidden',
          message: errMsg,
        });
      } else if (status === 404) {
        // Invalid or non-existent token
        setFeedback({
          type: 'error',
          message: errMsg,
        });
      } else {
        setFeedback({
          type: 'error',
          message: errMsg,
        });
      }

      // Resume camera after failure if in camera mode
      if (html5QrcodeRef.current) {
        try {
          await html5QrcodeRef.current.resume();
        } catch (e) {
          // ignore
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualFormSubmit = (e) => {
    e.preventDefault();
    handleTokenSubmitted(manualToken);
  };

  const handleResetScan = () => {
    setFeedback(null);
    setManualToken('');
    if (scanMode === 'camera') {
      startCamera();
    }
  };

  const handleCloseModal = () => {
    stopCamera();
    setFeedback(null);
    setManualToken('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCloseModal}
      title="Customer QR Check-In"
      subtitle="Scan digital QR ticket or enter token manually to check in customer"
    >
      <div className="space-y-5">
        {/* Scan Mode Selector Tabs */}
        <div className="flex items-center p-1 bg-sq-bg rounded-xl border border-sq-border">
          <button
            type="button"
            onClick={() => {
              setScanMode('camera');
              setFeedback(null);
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
              scanMode === 'camera'
                ? 'bg-sq-primary text-white shadow-md'
                : 'text-sq-textSecondary hover:text-white'
            }`}
          >
            <Camera className="w-4 h-4" /> Camera Scanner
          </button>
          <button
            type="button"
            onClick={() => {
              setScanMode('manual');
              stopCamera();
              setFeedback(null);
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
              scanMode === 'manual'
                ? 'bg-sq-primary text-white shadow-md'
                : 'text-sq-textSecondary hover:text-white'
            }`}
          >
            <Keyboard className="w-4 h-4" /> Manual Token Input
          </button>
        </div>

        {/* Feedback Alert Banners */}
        {feedback && (
          <div
            className={`p-4 rounded-xl border space-y-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : feedback.type === 'conflict'
                ? 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                : feedback.type === 'forbidden'
                ? 'bg-sq-surfaceSecondary border-sq-warning text-sq-textSecondary'
                : 'bg-red-950/40 border-red-500/30 text-red-300'
            }`}
          >
            <div className="flex items-start gap-3">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : feedback.type === 'conflict' ? (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              ) : feedback.type === 'forbidden' ? (
                <ShieldAlert className="w-5 h-5 text-sq-textSecondary shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  {feedback.type === 'success'
                    ? 'Customer Checked In'
                    : feedback.type === 'conflict'
                    ? 'Already Checked In'
                    : feedback.type === 'forbidden'
                    ? 'Access Restricted'
                    : 'Check-In Failed'}
                </h4>
                <p className="text-xs leading-relaxed">{feedback.message}</p>

                {feedback.data?.ticketNumber && (
                  <div className="pt-1 flex items-center gap-2">
                    <Badge variant="pink" size="sm">
                      Ticket #{feedback.data.ticketNumber}
                    </Badge>
                    {feedback.data.checkedInAt && (
                      <span className="text-[11px] opacity-80">
                        Checked in at{' '}
                        {new Date(feedback.data.checkedInAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Camera Viewport Section */}
        {scanMode === 'camera' && (
          <div className="space-y-3">
            <div className="relative w-full overflow-hidden rounded-2xl bg-sq-bg border border-sq-border min-h-[260px] flex items-center justify-center">
              <div id="qr-reader-viewport" className="w-full max-w-sm mx-auto" />

              {cameraState === 'starting' && (
                <div className="absolute inset-0 bg-sq-bg flex flex-col items-center justify-center space-y-2 text-sq-textSecondary">
                  <RefreshCw className="w-6 h-6 animate-spin text-sq-primary" />
                  <span className="text-xs">Initializing camera scanner...</span>
                </div>
              )}

              {cameraState === 'denied' && (
                <div className="absolute inset-0 bg-sq-bg p-6 flex flex-col items-center justify-center text-center space-y-3 text-sq-textSecondary">
                  <ShieldAlert className="w-10 h-10 text-amber-400" />
                  <p className="text-xs font-semibold text-white">Camera Permission Denied</p>
                  <p className="text-[11px]">
                    Camera permission is required to scan QR codes. Please enable camera access in your browser settings or use manual token input.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setScanMode('manual')}
                  >
                    Switch to Manual Token Input
                  </Button>
                </div>
              )}

              {cameraState === 'unavailable' && (
                <div className="absolute inset-0 bg-sq-bg p-6 flex flex-col items-center justify-center text-center space-y-3 text-sq-textSecondary">
                  <Camera className="w-10 h-10 text-red-400" />
                  <p className="text-xs font-semibold text-white">Camera Unavailable</p>
                  <p className="text-[11px]">
                    No camera device was detected or camera is in use by another application. Use manual token input to proceed.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setScanMode('manual')}
                  >
                    Switch to Manual Token Input
                  </Button>
                </div>
              )}
            </div>

            <p className="text-[11px] text-sq-muted text-center">
              Point camera directly at customer's digital QR ticket. Validation is instant and automatic.
            </p>
          </div>
        )}

        {/* Manual Input Fallback Section */}
        {scanMode === 'manual' && (
          <form onSubmit={handleManualFormSubmit} className="space-y-4 pt-2">
            <Input
              label="Enter Customer QR Token"
              placeholder="SMARTQUEUE:..."
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              required
              autoFocus
            />

            <p className="text-[11px] text-sq-muted">
              Paste or type the opaque <code>SMARTQUEUE:...</code> token provided on customer ticket.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setManualToken('')}
              >
                Clear
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                icon={QrCode}
                isLoading={isProcessing}
                disabled={!manualToken.trim()}
              >
                Validate & Check In
              </Button>
            </div>
          </form>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-sq-border pt-3">
          {feedback ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={handleResetScan}
            >
              Scan Another Ticket
            </Button>
          ) : (
            <div />
          )}

          <Button type="button" variant="secondary" size="sm" onClick={handleCloseModal}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default QrCheckInModal;
