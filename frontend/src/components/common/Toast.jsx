import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

/**
 * Reusable SmartQueue Toast Notification Banner Foundation
 */
const Toast = ({
  message,
  type = 'info', // success, error, warning, info
  onClose,
  className = '',
}) => {
  const toastConfig = {
    success: {
      icon: CheckCircle2,
      styles: 'bg-emerald-950/90 text-emerald-200 border-emerald-500/30',
    },
    error: {
      icon: AlertCircle,
      styles: 'bg-red-950/90 text-red-200 border-red-500/30',
    },
    warning: {
      icon: AlertTriangle,
      styles: 'bg-amber-950/90 text-amber-200 border-amber-500/30',
    },
    info: {
      icon: Info,
      styles: 'bg-blue-950/90 text-blue-200 border-blue-500/30',
    },
  };

  const Config = toastConfig[type] || toastConfig.info;
  const ToastIcon = Config.icon;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2 ${Config.styles} ${className}`}
      role="alert"
    >
      <ToastIcon className="w-5 h-5 shrink-0" />
      <span className="text-sm font-medium flex-1">{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-md transition-colors"
          aria-label="Dismiss toast"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default Toast;
