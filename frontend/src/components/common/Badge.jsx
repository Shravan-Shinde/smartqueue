import React from 'react';

/**
 * Reusable SmartQueue Badge Component
 * Warm Architectural Palette (#AC8968, #93785B, #865D36, #A69080)
 */
const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className = '',
}) => {
  const variantStyles = {
    default: 'bg-sq-surfaceSecondary text-sq-textSecondary border border-sq-border',
    sage: 'bg-sq-successBg text-sq-success border border-sq-border',
    brown: 'bg-sq-warningBg text-sq-warning border border-sq-border',
    cream: 'bg-sq-surfaceSecondary text-sq-textPrimary border border-sq-border',
    pink: 'bg-sq-dangerBg text-sq-danger border border-sq-border',
    lavender: 'bg-sq-infoBg text-sq-info border border-sq-border',
    purple: 'bg-sq-infoBg text-sq-info border border-sq-border',
    success: 'bg-sq-successBg text-sq-success border border-sq-border',
    warning: 'bg-sq-warningBg text-sq-warning border border-sq-border',
    danger: 'bg-sq-dangerBg text-sq-danger border border-sq-border',
    info: 'bg-sq-infoBg text-sq-info border border-sq-border',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs font-medium',
    md: 'px-2.5 py-1 text-xs font-semibold',
    lg: 'px-3 py-1.5 text-sm font-bold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {children}
    </span>
  );
};

export default Badge;
