import React from 'react';

/**
 * Reusable SmartQueue Skeleton Loader Component
 */
const SkeletonLoader = ({
  variant = 'card', // card, text, avatar, table
  count = 1,
  className = '',
}) => {
  const items = Array.from({ length: count });

  if (variant === 'text') {
    return (
      <div className="space-y-2">
        {items.map((_, i) => (
          <div
            key={i}
            className={`h-4 bg-sq-surfaceSecondary rounded-md animate-pulse ${
              i === count - 1 ? 'w-2/3' : 'w-full'
            } ${className}`}
          />
        ))}
      </div>
    );
  }

  if (variant === 'avatar') {
    return (
      <div className={`w-10 h-10 bg-sq-surfaceSecondary rounded-full animate-pulse ${className}`} />
    );
  }

  if (variant === 'table') {
    return (
      <div className="space-y-3">
        {items.map((_, i) => (
          <div
            key={i}
            className="h-12 bg-sq-surface border border-sq-border rounded-xl animate-pulse p-4 flex items-center justify-between"
          >
            <div className="w-1/4 h-4 bg-sq-surfaceSecondary rounded" />
            <div className="w-1/4 h-4 bg-sq-surfaceSecondary rounded" />
            <div className="w-1/6 h-4 bg-sq-surfaceSecondary rounded" />
          </div>
        ))}
      </div>
    );
  }

  // Default card variant
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((_, i) => (
        <div
          key={i}
          className={`bg-sq-surface border border-sq-border rounded-2xl p-6 space-y-4 animate-pulse ${className}`}
        >
          <div className="flex justify-between items-center">
            <div className="w-1/3 h-4 bg-sq-surfaceSecondary rounded" />
            <div className="w-8 h-8 bg-sq-surfaceSecondary rounded-full" />
          </div>
          <div className="w-2/3 h-8 bg-sq-surfaceSecondary rounded-lg" />
          <div className="w-full h-3 bg-sq-surfaceSecondary rounded" />
        </div>
      ))}
    </div>
  );
};

export default SkeletonLoader;
