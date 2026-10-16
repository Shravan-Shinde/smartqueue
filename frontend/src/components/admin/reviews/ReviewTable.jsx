import React from 'react';
import { Star, Eye, EyeOff, MessageSquare, Ticket, Building2, User } from 'lucide-react';
import Card from '../../common/Card';
import Badge from '../../common/Badge';
import Button from '../../common/Button';

/**
 * Admin Reviews List Table Component with Status Moderation Toggle
 */
const ReviewTable = ({ reviews, loading, onToggleStatus }) => {
  if (loading) {
    return (
      <Card variant="surface" className="p-6 space-y-4">
        <div className="h-6 w-48 bg-sq-surfaceSecondary rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="h-16 bg-sq-surfaceSecondary rounded-xl border border-sq-border animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  if (!reviews || reviews.length === 0) {
    return (
      <Card variant="surface" className="p-12 text-center space-y-3">
        <MessageSquare className="w-10 h-10 mx-auto text-sq-muted opacity-50" />
        <h3 className="text-base font-bold text-white">No Reviews Found</h3>
        <p className="text-xs text-sq-textSecondary max-w-md mx-auto">
          No customer reviews match your selected filter criteria. Try resetting or adjusting the rating, hierarchy, or date filters.
        </p>
      </Card>
    );
  }

  return (
    <Card variant="surface" className="p-0 overflow-hidden border border-sq-border">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-sq-textSecondary">
          <thead className="-sq-surface-sq-textPrimary uppercase text-[10px] font-bold tracking-wider border-b border-sq-border">
            <tr>
              <th className="py-3.5 px-4">Rating</th>
              <th className="py-3.5 px-4">Customer Comment</th>
              <th className="py-3.5 px-4">Customer</th>
              <th className="py-3.5 px-4">Ticket / Queue</th>
              <th className="py-3.5 px-4">Date</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {reviews.map((rev) => {
              const customerName = rev.customerId?.fullName || rev.customerId?.name || 'Customer';
              const ticketNum = rev.queueEntryId?.ticketNumber || 'TICKET';
              const queueName = rev.queueId?.name || rev.departmentId?.name || 'Service Queue';
              const orgName = rev.organizationId?.name || '';
              const dateStr = rev.createdAt
                ? new Date(rev.createdAt).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'N/A';

              const isHidden = rev.status === 'HIDDEN';

              return (
                <tr key={rev._id || rev.id} className="hover:bg-white/[0.02] transition-colors">
                  {/* Rating Stars */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-amber-400 font-bold">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-3.5 h-3.5 ${
                              star <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-sq-textPrimary'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-white ml-1">{rev.rating}.0</span>
                    </div>
                  </td>

                  {/* Customer Comment */}
                  <td className="py-3.5 px-4 max-w-xs">
                    {rev.comment ? (
                      <p className="text-white font-normal line-clamp-2 leading-relaxed italic">
                        "{rev.comment}"
                      </p>
                    ) : (
                      <span className="text-sq-muted italic">No comment provided</span>
                    )}
                  </td>

                  {/* Customer */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-sq-surfaceSecondary text-sq-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="font-bold text-white block">{customerName}</span>
                        {rev.customerId?.email && (
                          <span className="text-[10px] text-sq-muted block">
                            {rev.customerId.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Ticket & Hierarchy */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <Ticket className="w-3.5 h-3.5 text-sq-primary" />
                        <span>{ticketNum}</span>
                      </div>
                      <div className="text-[10px] text-sq-muted">
                        {queueName} {orgName ? `• ${orgName}` : ''}
                      </div>
                    </div>
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-4 whitespace-nowrap text-[11px] text-sq-textSecondary">
                    {dateStr}
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <Badge variant={isHidden ? 'secondary' : 'success'} size="sm">
                      {rev.status}
                    </Badge>
                  </td>

                  {/* Moderate Action */}
                  <td className="py-3.5 px-4 whitespace-nowrap text-right">
                    <Button
                      variant={isHidden ? 'secondary' : 'ghost'}
                      size="sm"
                      icon={isHidden ? Eye : EyeOff}
                      onClick={() => onToggleStatus(rev._id || rev.id, isHidden ? 'PUBLISHED' : 'HIDDEN')}
                    >
                      {isHidden ? 'Publish' : 'Hide'}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default ReviewTable;
