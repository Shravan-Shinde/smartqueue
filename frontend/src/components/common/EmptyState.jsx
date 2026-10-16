import React from 'react';
import { Inbox } from 'lucide-react';
import Button from './Button';

/**
 * Reusable SmartQueue Empty State Component
 */
const EmptyState = ({
  icon: Icon = Inbox,
  title = 'No Queue Activity',
  description = 'There are no active queue tickets or operational counters found at this moment.',
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 border border-dashed border-sq-warning rounded-2xl bg-sq-bg ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-sq-primarySubtle text-sq-textSecondary border border-sq-borderStrong flex items-center justify-center mb-4 shadow-lg shadow-sm">
        <Icon className="w-7 h-7" />
      </div>
      <h4 className="text-lg font-extrabold text-sq-textPrimary">{title}</h4>
      <p className="text-xs text-sq-textSecondary max-w-sm mt-1.5 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <div className="mt-5">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};

export default EmptyState;
