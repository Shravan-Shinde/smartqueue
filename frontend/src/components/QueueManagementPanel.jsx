import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit3, Power, Layers, Clock, Users, Play, Pause, XCircle } from 'lucide-react';
import Card from './common/Card';
import Badge from './common/Badge';
import Button from './common/Button';
import Input from './common/Input';
import Modal from './common/Modal';
import SkeletonLoader from './common/SkeletonLoader';
import EmptyState from './common/EmptyState';
import adminCounterQueueService from '../services/adminCounterQueueService';

/**
 * Queue Management Panel Component for Admin Dashboard
 */
const QueueManagementPanel = ({ organizationId, locationId, departmentId, departmentName, setToast }) => {
  const [queues, setQueues] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQueue, setEditingQueue] = useState(null); // null = create, object = edit
  const [formData, setFormData] = useState({
    name: '',
    prefix: 'GEN',
    description: '',
    avgServiceTimeMins: 15,
    maxCapacity: 100,
    status: 'CLOSED',
    isActive: true,
  });
  const [formError, setFormError] = useState('');

  // Status confirmation modal state
  const [statusConfirm, setStatusConfirm] = useState(null); // { queue, targetStatus }
  const [confirmItem, setConfirmItem] = useState(null);

  // Fetch queues
  const fetchQueues = useCallback(async () => {
    if (!organizationId || !locationId || !departmentId) return;
    setIsLoading(true);
    try {
      const res = await adminCounterQueueService.getQueues(organizationId, locationId, departmentId);
      setQueues(res.data || []);
    } catch (err) {
      setToast({ type: 'error', text: err.message || 'Failed to load queues.' });
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, locationId, departmentId, setToast]);

  useEffect(() => {
    fetchQueues();
  }, [fetchQueues]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingQueue(null);
    setFormData({
      name: '',
      prefix: 'GEN',
      description: '',
      avgServiceTimeMins: 15,
      maxCapacity: 100,
      status: 'CLOSED',
      isActive: true,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (queue) => {
    setEditingQueue(queue);
    setFormData({
      name: queue.name,
      prefix: queue.prefix || 'GEN',
      description: queue.description || '',
      avgServiceTimeMins: queue.avgServiceTimeMins || 15,
      maxCapacity: queue.maxCapacity || 100,
      status: queue.status || 'CLOSED',
      isActive: queue.isActive,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  // Handle Create / Edit Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);
    try {
      if (editingQueue) {
        await adminCounterQueueService.updateQueue(
          organizationId,
          locationId,
          departmentId,
          editingQueue._id,
          formData
        );
        setToast({ type: 'success', text: 'Queue updated successfully!' });
      } else {
        await adminCounterQueueService.createQueue(
          organizationId,
          locationId,
          departmentId,
          formData
        );
        setToast({ type: 'success', text: 'Queue created successfully!' });
      }
      setIsModalOpen(false);
      fetchQueues();
    } catch (err) {
      setFormError(err.message || 'Failed to save queue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Request status change with confirmation for PAUSED or CLOSED
  const handleRequestStatusChange = (queue, targetStatus) => {
    if (queue.status === targetStatus) return;

    if (targetStatus === 'PAUSED' || targetStatus === 'CLOSED') {
      setStatusConfirm({ queue, targetStatus });
    } else {
      executeStatusChange(queue, targetStatus);
    }
  };

  const executeStatusChange = async (queue, targetStatus) => {
    try {
      await adminCounterQueueService.updateQueueStatus(
        organizationId,
        locationId,
        departmentId,
        queue._id,
        { status: targetStatus }
      );
      setToast({ type: 'info', text: `Queue status changed to ${targetStatus}` });
      setStatusConfirm(null);
      fetchQueues();
    } catch (err) {
      setToast({ type: 'error', text: err.message || 'Failed to update queue status.' });
    }
  };

  // Toggle Active/Inactive state
  const handleToggleActive = async (queue) => {
    try {
      await adminCounterQueueService.updateQueueStatus(
        organizationId,
        locationId,
        departmentId,
        queue._id,
        { isActive: !queue.isActive }
      );
      setToast({ type: 'info', text: queue.isActive ? 'Queue deactivated' : 'Queue reactivated' });
      setConfirmItem(null);
      fetchQueues();
    } catch (err) {
      setToast({ type: 'error', text: err.message || 'Failed to toggle queue active status.' });
    }
  };

  const getQueueStatusBadge = (status) => {
    switch (status) {
      case 'OPEN':
        return <Badge variant="success" size="sm" dot>OPEN</Badge>;
      case 'PAUSED':
        return <Badge variant="warning" size="sm" dot>PAUSED</Badge>;
      case 'CLOSED':
      default:
        return <Badge variant="danger" size="sm" dot>CLOSED</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-sq-surfaceSecondary p-4 rounded-xl border border-sq-border">
        <div>
          <h3 className="text-sm font-bold text-sq-textPrimary">
            Queues ({queues.length})
          </h3>
          <p className="text-xs text-sq-textSecondary">
            Configured queue lines for <span className="text-sq-info">{departmentName}</span>
          </p>
        </div>
        <Button variant="primary" size="sm" icon={Plus} onClick={handleOpenCreate}>
          Create Queue
        </Button>
      </div>

      {/* Queues Grid / List */}
      {isLoading ? (
        <SkeletonLoader variant="cards" count={3} />
      ) : queues.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No Queues Configured"
          description="No queues exist for this department. Create a queue to configure service token parameters."
          actionLabel="Create Queue"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {queues.map((queue) => (
            <Card
              key={queue._id}
              variant="surface"
              className={`p-4 space-y-3 border transition-all ${
                queue.isActive ? 'border-sq-border hover:border-sq-border' : 'border-red-500/20 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-sq-infoBg text-sq-info border border-sq-info text-xs font-mono font-bold">
                      {queue.prefix}
                    </span>
                    <h4 className="text-xs font-bold text-sq-textPrimary">{queue.name}</h4>
                  </div>
                  <p className="text-[11px] text-sq-textSecondary mt-1 line-clamp-1">
                    {queue.description || 'No description provided.'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {getQueueStatusBadge(queue.status)}
                  <Badge variant={queue.isActive ? 'success' : 'danger'} size="sm">
                    {queue.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </Badge>
                </div>
              </div>

              {/* Specs parameters */}
              <div className="grid grid-cols-2 gap-2 p-2.5 bg-sq-surfaceSecondary rounded-xl text-[11px]">
                <div className="flex items-center gap-1.5 text-sq-textSecondary">
                  <Clock className="w-3.5 h-3.5 text-sq-info" />
                  <span>{queue.avgServiceTimeMins} mins avg</span>
                </div>
                <div className="flex items-center gap-1.5 text-sq-textSecondary">
                  <Users className="w-3.5 h-3.5 text-sq-primary" />
                  <span>Max {queue.maxCapacity} cap</span>
                </div>
              </div>

              {/* Status Controls */}
              <div className="pt-2 border-t border-sq-border flex items-center justify-between">
                <span className="text-[10px] text-sq-muted uppercase font-semibold">Queue Status:</span>
                <div className="flex items-center gap-1">
                  {[
                    { status: 'OPEN', label: 'OPEN', icon: Play },
                    { status: 'PAUSED', label: 'PAUSE', icon: Pause },
                    { status: 'CLOSED', label: 'CLOSE', icon: XCircle },
                  ].map((st) => {
                    const StIcon = st.icon;
                    const isCurrent = queue.status === st.status;
                    return (
                      <button
                        key={st.status}
                        disabled={!queue.isActive}
                        onClick={() => handleRequestStatusChange(queue, st.status)}
                        className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-all ${
                          isCurrent
                            ? st.status === 'OPEN'
                              ? 'bg-emerald-500 text-white shadow-sm'
                              : st.status === 'PAUSED'
                              ? 'bg-amber-500 text-white shadow-sm'
                              : 'bg-rose-500 text-white shadow-sm'
                            : 'bg-sq-surfaceSecondary text-sq-textSecondary hover:text-sq-textPrimary border border-sq-border'
                        } ${!queue.isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <StIcon className="w-3 h-3" />
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-sq-border flex items-center justify-end gap-2">
                <button
                  onClick={() => handleOpenEdit(queue)}
                  className="px-2.5 py-1 text-[11px] font-semibold text-sq-info hover:bg-sq-infoBg rounded-lg transition-colors flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>

                <button
                  onClick={() => setConfirmItem(queue)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors flex items-center gap-1 ${
                    queue.isActive
                      ? 'text-red-400 hover:bg-red-500/10'
                      : 'text-emerald-400 hover:bg-emerald-500/10'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  {queue.isActive ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* CREATE / EDIT QUEUE MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingQueue ? 'Edit Queue' : 'Create Queue'}
        subtitle={`Configure service queue parameters for ${departmentName}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <p className="text-xs text-red-400 bg-red-950/80 p-2.5 rounded-xl border border-red-500/30">
              {formError}
            </p>
          )}

          <Input
            label="Queue Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. General Consultation, Loan Enquiries, Passport Renewal"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Token Prefix *"
              value={formData.prefix}
              onChange={(e) => setFormData({ ...formData, prefix: e.target.value.toUpperCase() })}
              placeholder="e.g. GEN, CARD, LOAN"
              required
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-sq-textSecondary">Initial Status *</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-sq-surfaceSecondary text-xs text-sq-textPrimary rounded-xl px-4 py-2.5 border border-sq-border focus:outline-none focus:border-sq-primary"
              >
                <option value="CLOSED">CLOSED</option>
                <option value="OPEN">OPEN</option>
                <option value="PAUSED">PAUSED</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-sq-textSecondary">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              placeholder="Standard line for walk-in consultations..."
              className="w-full bg-sq-surfaceSecondary text-xs text-sq-textPrimary placeholder-sq-muted rounded-xl p-3 border border-sq-border focus:outline-none focus:border-sq-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Avg Service Time (mins) *"
              type="number"
              min="1"
              max="480"
              value={formData.avgServiceTimeMins}
              onChange={(e) => setFormData({ ...formData, avgServiceTimeMins: parseInt(e.target.value) || 15 })}
              required
            />

            <Input
              label="Maximum Capacity *"
              type="number"
              min="1"
              max="10000"
              value={formData.maxCapacity}
              onChange={(e) => setFormData({ ...formData, maxCapacity: parseInt(e.target.value) || 100 })}
              required
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <label className="flex items-center gap-2 text-xs text-sq-textPrimary cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded bg-sq-surfaceSecondary border-sq-border text-sq-primary"
              />
              Active Queue (Available for future customer join operations)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-sq-border">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              {editingQueue ? 'Update Queue' : 'Create Queue'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* STATUS CHANGE CONFIRMATION MODAL */}
      <Modal
        isOpen={!!statusConfirm}
        onClose={() => setStatusConfirm(null)}
        title={`${statusConfirm?.targetStatus === 'PAUSED' ? 'Pause Queue' : 'Close Queue'}?`}
      >
        <div className="space-y-4">
          <p className="text-xs text-sq-textSecondary">
            {statusConfirm?.targetStatus === 'PAUSED'
              ? `Are you sure you want to pause "${statusConfirm?.queue?.name}"? Customers will not be able to join while the queue is paused.`
              : `Are you sure you want to close "${statusConfirm?.queue?.name}"? Customers will not be able to join while the queue is closed.`}
          </p>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setStatusConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant={statusConfirm?.targetStatus === 'PAUSED' ? 'warning' : 'danger'}
              size="sm"
              onClick={() => executeStatusChange(statusConfirm.queue, statusConfirm.targetStatus)}
            >
              Confirm {statusConfirm?.targetStatus}
            </Button>
          </div>
        </div>
      </Modal>

      {/* CONFIRMATION DEACTIVATION MODAL */}
      <Modal
        isOpen={!!confirmItem}
        onClose={() => setConfirmItem(null)}
        title={confirmItem?.isActive ? 'Deactivate Queue?' : 'Reactivate Queue?'}
      >
        <div className="space-y-4">
          <p className="text-xs text-sq-textSecondary">
            {confirmItem?.isActive
              ? `Are you sure you want to deactivate "${confirmItem?.name}"? Inactive queues will not be available for customer queue joining.`
              : `Are you sure you want to reactivate "${confirmItem?.name}"?`}
          </p>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmItem(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmItem?.isActive ? 'danger' : 'primary'}
              size="sm"
              onClick={() => handleToggleActive(confirmItem)}
            >
              {confirmItem?.isActive ? 'Confirm Deactivation' : 'Confirm Reactivation'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default QueueManagementPanel;
