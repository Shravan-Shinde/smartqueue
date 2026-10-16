import React, { useId } from 'react';

/**
 * Reusable SmartQueue Form Input Component
 * Warm Architectural Palette (#41372E, #F4EEE7, #AC8968)
 */
const Input = ({
  label,
  error,
  helperText,
  icon: Icon,
  type = 'text',
  className = '',
  id: customId,
  ...props
}) => {
  const generatedId = useId();
  const inputId = customId || generatedId;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold uppercase tracking-wider text-sq-textSecondary"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sq-muted">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          id={inputId}
          type={type}
          className={`w-full bg-sq-surface text-sq-textPrimary placeholder-sq-muted text-sm rounded-xl border border-sq-border ${
            Icon ? 'pl-10' : 'pl-4'
          } pr-4 py-2.5 transition-all duration-200 focus:outline-none focus:border-sq-primary focus:ring-1 focus:ring-sq-primary disabled:opacity-50 disabled:bg-sq-surfaceSecondary ${
            error ? 'border-sq-danger focus:border-sq-danger focus:ring-sq-danger' : ''
          } ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-sq-danger mt-1">{error}</p>}
      {helperText && !error && (
        <p className="text-xs text-sq-muted mt-1">{helperText}</p>
      )}
    </div>
  );
};

export default Input;
