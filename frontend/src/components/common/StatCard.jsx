import React from 'react';

/**
 * Reusable SmartQueue Metric StatCard Component
 */
const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendPositive = true,
  accentColor = 'sage', // sage, brown, cream, emerald
  className = '',
}) => {
  const accentGlow = {
    sage: 'bg-sq-primarySubtle text-sq-textSecondary border border-sq-borderStrong',
    brown: 'bg-sq-warningBg text-sq-warning border border-sq-warning',
    cream: 'bg-sq-bg/15 text-sq-textPrimary border border-sq-border/30',
    pink: 'bg-sq-warningBg text-sq-warning border border-sq-warning',
    purple: 'bg-sq-primarySubtle text-sq-textSecondary border border-sq-borderStrong',
    emerald: 'bg-sq-primarySubtle text-sq-textSecondary border border-sq-borderStrong',
  };

  return (
    <div
      className={`bg-sq-bg border border-sq-warning rounded-2xl p-5 hover:border-sq-borderStrong shadow-lg shadow-black/40 transition-all duration-300 ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-sq-warning">
          {title}
        </span>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${accentGlow[accentColor] || accentGlow.sage}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-3xl font-extrabold text-sq-textPrimary tracking-tight">
          {value}
        </span>
        {trend && (
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-md ${
              trendPositive
                ? 'bg-sq-primarySubtle text-sq-textSecondary border border-sq-borderStrong'
                : 'bg-red-500/15 text-red-300 border border-red-500/30'
            }`}
          >
            {trendPositive ? '↑' : '↓'} {trend}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="text-xs text-sq-muted mt-2 font-medium">{subtitle}</p>
      )}
    </div>
  );
};

export default StatCard;
