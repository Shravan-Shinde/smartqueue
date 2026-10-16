import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit3, Power, Monitor, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import Card from './common/Card';
import Badge from './common/Badge';
import Button from './common/Button';
import Input from './common/Input';
import Modal from './common/Modal';
import SkeletonLoader from './common/SkeletonLoader';
import EmptyState from './common/EmptyState';
import adminCounterQueueService from '../services/adminCounterQueueService';

/**
 * Counter Management Panel Component for Admin Dashboard
 */
const CounterManagementPanel = ({ organizationId, locationId, departmentId, departmentName, setToast }) => {
  const [counters, setCounters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCounter, setEditingCounter] = useState(null); // null = create, object = edit
  const [formData, setFormData] = useState({
    name: '',
    number: '',
    status: 'OFFLINE',
    isActive: true,
  });
  const [formError, setFormError] = useState('');

  // Status modal state
  const [confirmItem, setConfirmItem] = useState(null);

  // Fetch counters
  const fetchCounters = useCallback(async () => {
    if (!organizationId || !locationId || !departmentId) return;
    setIsLoading(true);
    try {
      const res = await adminCounterQueueService.getCounters(organizationId, locationId, departmentId);
      setCounters(res.data || []);
    } catch (err) {
      setToast({ type: 'error', text: err.message || 'Failed to load counters.' });
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, locationId, departmentId, setToast]);

  useEffect(() => {
    fetchCounters();
  }, [fetchCounters]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingCounter(null);
    setFormData({
      name: '',
      number: '',
      status: 'OFFLINE',
      isActive: true,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (counter) => {
    setEditingCounter(counter);
    setFormData({
      name: counter.name,
      number: counter.number || '',
      status: counter.status || 'OFFLINE',
      isActive: counter.isActive,
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
      if (editingCounter) {
        await adminCounterQueueService.updateCounter(
          organizationId,
          locationId,
          departmentId,
          editingCounter._id,
          formData
        );
        setToast({ type: 'success', text: 'Counter updated successfully!' });
      } else {
        await adminCounterQueueService.createCounter(
          organizationId,
          locationId,
          departmentId,
          formData
        );
        setToast({ type: 'success', text: 'Counter created successfully!' });
      }
      setIsModalOpen(false);
      fetchCounters();
    } catch (err) {
      setFormError(err.message || 'Failed to save counter.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Change status (AVAILABLE, BUSY, OFFLINE)
  const handleChangeStatus = async (counter, newStatus) => {
    try {
      await adminCounterQueueService.updateCounterStatus(
        organizationId,
        locationId,
        departmentId,
        counter._id,
        { status: newStatus }
      );
      setToast({ type: 'info', text: `Counter status changed to ${newStatus}` });
      fetchCounters();
    } catch (err) {
      setToast({ type: 'error', text: err.message || 'Failed to update status.' });
    }
  };

  // Toggle Active/Inactive state
  const handleToggleActive = async (counter) => {
    try {
      const res = await adminCounterQueueService.updateCounterStatus(
        organizationId,
        locationId,
        departmentId,
        counter._id,
        { isActive: !counter.isActive }
      );
      setToast({ type: 'info', text: counter.isActive ? 'Counter deactivated' : 'Counter reactivated' });
      setConfirmItem(null);
      fetchCounters();
    } catch (err) {
      setToast({ type: 'error', text: err.message || 'Failed to toggle counter active status.' });
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'AVAILABLE':
        return <Badge variant="success" size="sm" dot>AVAILABLE</Badge>;
      case 'BUSY':
        return <Badge variant="warning" size="sm" dot>BUSY</Badge>;
      case 'OFFLINE':
      default:
        return <Badge variant="secondary" size="sm" dot>OFFLINE</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-sq-surfaceSecondary p-4 rounded-xl border border-sq-border">
        <div>
          <h3 className="text-sm font-bold text-sq-textPrimary">
            Counters ({counters.length})
          </h3>
          <p className="text-xs text-sq-textSecondary">
            Configured service counters for <span className="text-sq-info">{departmentName}</span>
          </p>
        </div>
        <Button variant="primary" size="sm" icon={Plus} onClick={handleOpenCreate}>
          Add Counter
        </Button>
      </div>

      {/* Counters Grid / List */}
      {isLoading ? (
        <SkeletonLoader variant="cards" count={3} />
      ) : counters.length === 0 ? (
        <EmptyState
          icon={Monitor}
          title="No Counters Configured"
          description="No counters exist for this department. Add a counter to configure physical service points."
          actionLabel="Add Counter"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {counters.map((counter) => (
            <Card
              key={counter._id}
              variant="surface"
              className={`p-4 space-y-3 border transition-all ${
                counter.isActive ? 'border-sq-border hover:border-sq-border' : 'border-red-500/20 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-sq-surfaceSecondary text-sq-info flex items-center justify-center font-bold text-xs">
                    {counter.number || '#'}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-sq-textPrimary">{counter.name}</h4>
                    <span className="text-[10px] text-sq-muted">
                      Counter #{counter.number || 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {getStatusBadge(counter.status)}
                  <Badge variant={counter.isActive ? 'success' : 'danger'} size="sm">
                    {counter.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </Badge>
                </div>
              </div>

              {/* Status Change Selector */}
              <div className="pt-2 border-t border-sq-border flex items-center justify-between">
                <span className="text-[10px] text-sq-muted uppercase font-semibold">Change Status:</span>
                <div className="flex items-center gap-1">
                  {['AVAILABLE', 'BUSY', 'OFFLINE'].map((st) => (
                    <button
                      key={st}
                      disabled={!counter.isActive}
                      onClick={() => handleChangeStatus(counter, st)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                        counter.status === st
                          ? 'bg-sq-primary text-white shadow-sm'
                          : 'bg-sq-surfaceSecondary text-sq-textSecondary hover:text-sq-textPrimary border border-sq-border'
                      } ${!counter.isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-sq-border flex items-center justify-end gap-2">
                <button
                  onClick={() => handleOpenEdit(counter)}
                  className="px-2.5 py-1 text-[11px] font-semibold text-sq-info hover:bg-sq-infoBg rounded-lg transition-colors flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>

                <button
                  onClick={() => setConfirmItem(counter)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors flex items-center gap-1 ${
                    counter.isActive
                      ? 'text-red-400 hover:bg-red-500/10'
                      : 'text-emerald-400 hover:bg-emerald-500/10'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  {counter.isActive ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* CREATE / EDIT COUNTER MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCounter ? 'Edit Counter' : 'Add Counter'}
        subtitle={`Configure counter for ${departmentName}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <p className="text-xs text-red-400 bg-red-950/80 p-2.5 rounded-xl border border-red-500/30">
              {formError}
            </p>
          )}

          <Input
            label="Counter Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Counter 1, Window A, Consultation Room 3"
            required
          />

          <Input
            label="Counter Number / Identifier"
            value={formData.number}
            onChange={(e) => setFormData({ ...formData, number: e.target.value })}
            placeholder="e.g. 1, 101, C-01"
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-sq-textSecondary">Initial Status *</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full bg-sq-surfaceSecondary text-xs text-sq-textPrimary rounded-xl px-4 py-2.5 border border-sq-border focus:outline-none focus:border-sq-primary"
            >
              <option value="OFFLINE">OFFLINE (Not currently serving)</option>
              <option value="AVAILABLE">AVAILABLE (Ready to serve)</option>
              <option value="BUSY">BUSY (Currently serving)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <label className="flex items-center gap-2 text-xs text-sq-textPrimary cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded bg-sq-surfaceSecondary border-sq-border text-sq-primary"
              />
              Active Counter (Available for operational queue routing)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-sq-border">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              {editingCounter ? 'Update Counter' : 'Create Counter'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* CONFIRMATION DEACTIVATION MODAL */}
      <Modal
        isOpen={!!confirmItem}
        onClose={() => setConfirmItem(null)}
        title={confirmItem?.isActive ? 'Deactivate Counter?' : 'Reactivate Counter?'}
      >
        <div className="space-y-4">
          <p className="text-xs text-sq-textSecondary">
            {confirmItem?.isActive
              ? `Are you sure you want to deactivate "${confirmItem?.name}"? Inactive counters will not be available for queue operations.`
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

export default CounterManagementPanel;
