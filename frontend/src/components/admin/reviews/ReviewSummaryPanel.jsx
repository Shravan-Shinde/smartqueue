import React from 'react';
import { Star, MessageSquare, Award, TrendingUp } from 'lucide-react';
import Card from '../../common/Card';

/**
 * Admin Review Rating Summary & Star Breakdown Panel Component
 */
const ReviewSummaryPanel = ({ summary, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-pulse">
        <div className="h-44 bg-sq-surfaceSecondary rounded-2xl border border-sq-border" />
        <div className="h-44 bg-sq-surfaceSecondary rounded-2xl border border-sq-border col-span-2" />
      </div>
    );
  }

  const { totalReviews = 0, averageRating = 0, breakdown = {} } = summary || {};

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Overview Score Card */}
      <Card variant="surface" className="p-6 flex flex-col justify-between border-l-4 border-l-amber-400">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sq-textSecondary">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Average Satisfaction Score</span>
          </div>
          <MessageSquare className="w-5 h-5 text-sq-muted" />
        </div>

        <div className="my-4 flex items-baseline gap-3">
          <span className="text-5xl font-black text-white tracking-tight">
            {averageRating > 0 ? averageRating.toFixed(1) : '0.0'}
          </span>
          <span className="text-sm font-semibold text-sq-muted">/ 5.0</span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1 text-amber-400">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-5 h-5 ${
                  star <= Math.round(averageRating)
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-sq-textPrimary'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-sq-textSecondary">
            Based on <strong className="text-white">{totalReviews}</strong> customer reviews
          </p>
        </div>
      </Card>

      {/* 5-Star Rating Breakdown Bars */}
      <Card variant="surface" className="p-6 col-span-1 lg:col-span-2 space-y-3">
        <div className="flex items-center justify-between border-b border-sq-border pb-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sq-textSecondary">
            <TrendingUp className="w-4 h-4 text-sq-primary" />
            <span>Rating Breakdown (5 Stars to 1 Star)</span>
          </div>
          <span className="text-xs text-sq-muted">Distribution (%)</span>
        </div>

        <div className="space-y-2.5 pt-1">
          {[5, 4, 3, 2, 1].map((starKey) => {
            const starData = breakdown[starKey] || { count: 0, percentage: 0 };
            const pct = starData.percentage || 0;
            const count = starData.count || 0;

            return (
              <div key={starKey} className="flex items-center gap-3 text-xs">
                <div className="w-12 font-bold text-white flex items-center gap-1 shrink-0">
                  <span>{starKey}</span>
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                </div>

                <div className="flex-1 h-3 bg-sq-surface rounded-full overflow-hidden border border-sq-border relative">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      starKey >= 4
                        ? 'bg-gradient-to-r from-amber-500 to-amber-300'
                        : starKey === 3
                        ? 'bg-gradient-to-r from-blue-500 to-blue-300'
                        : 'bg-gradient-to-r from-red-500 to-red-300'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                  />
                </div>

                <div className="w-24 text-right shrink-0 font-medium text-sq-textSecondary">
                  <span className="text-white font-bold">{count}</span> ({pct}%)
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

export default ReviewSummaryPanel;
