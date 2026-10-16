import React, { useState, useEffect } from 'react';
import { Filter, RotateCcw, Building2, MapPin, Briefcase, Layers, Calendar, Star, Eye } from 'lucide-react';
import Button from '../../common/Button';
import adminOrgService from '../../../services/adminOrgService';
import adminCounterQueueService from '../../../services/adminCounterQueueService';

const getPresetDates = (presetKey) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (presetKey === 'TODAY') {
    return {
      startDate: todayStart.toISOString().split('T')[0],
      endDate: todayEnd.toISOString().split('T')[0],
    };
  }

  if (presetKey === 'YESTERDAY') {
    const yestStart = new Date(todayStart);
    yestStart.setDate(yestStart.getDate() - 1);
    const yestEnd = new Date(todayEnd);
    yestEnd.setDate(yestEnd.getDate() - 1);
    return {
      startDate: yestStart.toISOString().split('T')[0],
      endDate: yestEnd.toISOString().split('T')[0],
    };
  }

  if (presetKey === 'LAST_7_DAYS') {
    const d7 = new Date(todayStart);
    d7.setDate(d7.getDate() - 6);
    return {
      startDate: d7.toISOString().split('T')[0],
      endDate: todayEnd.toISOString().split('T')[0],
    };
  }

  if (presetKey === 'LAST_30_DAYS') {
    const d30 = new Date(todayStart);
    d30.setDate(d30.getDate() - 29);
    return {
      startDate: d30.toISOString().split('T')[0],
      endDate: todayEnd.toISOString().split('T')[0],
    };
  }

  return { startDate: '', endDate: '' };
};

const ReviewFilters = ({ filters, onFilterChange, onReset }) => {
  const [organizations, setOrganizations] = useState([]);
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [queues, setQueues] = useState([]);

  // Fetch Organizations
  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const res = await adminOrgService.getOrganizations();
        if (res?.success) setOrganizations(res.data || []);
      } catch (err) {
        // ignore
      }
    };
    fetchOrgs();
  }, []);

  // Fetch Locations on Org change
  useEffect(() => {
    if (!filters.organizationId) {
      setLocations([]);
      return;
    }
    const fetchLocs = async () => {
      try {
        const res = await adminOrgService.getLocations(filters.organizationId);
        if (res?.success) setLocations(res.data || []);
      } catch (err) {
        // ignore
      }
    };
    fetchLocs();
  }, [filters.organizationId]);

  // Fetch Departments on Loc change
  useEffect(() => {
    if (!filters.locationId) {
      setDepartments([]);
      return;
    }
    const fetchDepts = async () => {
      try {
        const res = await adminOrgService.getDepartments(filters.locationId);
        if (res?.success) setDepartments(res.data || []);
      } catch (err) {
        // ignore
      }
    };
    fetchDepts();
  }, [filters.locationId]);

  // Fetch Queues on Dept change
  useEffect(() => {
    if (!filters.departmentId) {
      setQueues([]);
      return;
    }
    const fetchQ = async () => {
      try {
        const res = await adminCounterQueueService.getQueues({ departmentId: filters.departmentId });
        if (res?.success) setQueues(res.data || []);
      } catch (err) {
        // ignore
      }
    };
    fetchQ();
  }, [filters.departmentId]);

  const handleDatePreset = (presetKey) => {
    const dates = getPresetDates(presetKey);
    onFilterChange({ datePreset: presetKey, ...dates });
  };

  return (
    <div className="bg-sq-surfaceSecondary p-5 rounded-2xl border border-sq-border space-y-4">
      <div className="flex items-center justify-between border-b border-sq-border pb-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
          <Filter className="w-4 h-4 text-sq-primary" />
          <span>Filter Customer Reviews</span>
        </div>
        <Button variant="ghost" size="sm" icon={RotateCcw} onClick={onReset}>
          Reset Filters
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Rating Filter */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-sq-textSecondary flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-amber-400" /> Star Rating
          </label>
          <select
            value={filters.rating || ''}
            onChange={(e) => onFilterChange({ rating: e.target.value })}
            className="-sq-surface-sq-textPrimary focus:outline-none focus:border-sq-primary"
          >
            <option value="">All Ratings (1-5 Stars)</option>
            <option value="5">5 Stars ★★★★★</option>
            <option value="4">4 Stars ★★★★☆</option>
            <option value="3">3 Stars ★★★☆☆</option>
            <option value="2">2 Stars ★★☆☆☆</option>
            <option value="1">1 Star ★☆☆☆☆</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-sq-textSecondary flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-sq-info" /> Visibility Status
          </label>
          <select
            value={filters.status || ''}
            onChange={(e) => onFilterChange({ status: e.target.value })}
            className="-sq-surface-sq-textPrimary focus:outline-none focus:border-sq-primary"
          >
            <option value="">All Statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="HIDDEN">Hidden</option>
          </select>
        </div>

        {/* Date Preset Filter */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-sq-textSecondary flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-sq-primary" /> Date Range
          </label>
          <select
            value={filters.datePreset || 'ALL'}
            onChange={(e) => handleDatePreset(e.target.value)}
            className="-sq-surface-sq-textPrimary focus:outline-none focus:border-sq-primary"
          >
            <option value="ALL">All Time</option>
            <option value="TODAY">Today</option>
            <option value="YESTERDAY">Yesterday</option>
            <option value="LAST_7_DAYS">Last 7 Days</option>
            <option value="LAST_30_DAYS">Last 30 Days</option>
          </select>
        </div>

        {/* Organization Select */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-sq-textSecondary flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-sq-primary" /> Organization
          </label>
          <select
            value={filters.organizationId || ''}
            onChange={(e) =>
              onFilterChange({
                organizationId: e.target.value,
                locationId: '',
                departmentId: '',
                queueId: '',
              })
            }
            className="-sq-surface-sq-textPrimary focus:outline-none focus:border-sq-primary"
          >
            <option value="">All Organizations</option>
            {organizations.map((org) => (
              <option key={org._id || org.id} value={org._id || org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        {/* Location Select */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-sq-textSecondary flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-sq-info" /> Location
          </label>
          <select
            value={filters.locationId || ''}
            disabled={!filters.organizationId}
            onChange={(e) =>
              onFilterChange({
                locationId: e.target.value,
                departmentId: '',
                queueId: '',
              })
            }
            className="-sq-surface-sq-textPrimary focus:outline-none focus:border-sq-primary disabled:opacity-40"
          >
            <option value="">All Locations</option>
            {locations.map((loc) => (
              <option key={loc._id || loc.id} value={loc._id || loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Department Select */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-sq-textSecondary flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-sq-primary" /> Department
          </label>
          <select
            value={filters.departmentId || ''}
            disabled={!filters.locationId}
            onChange={(e) => onFilterChange({ departmentId: e.target.value, queueId: '' })}
            className="-sq-surface-sq-textPrimary focus:outline-none focus:border-sq-primary disabled:opacity-40"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept._id || dept.id} value={dept._id || dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        {/* Queue Select */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-sq-textSecondary flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sq-info" /> Queue
          </label>
          <select
            value={filters.queueId || ''}
            disabled={!filters.departmentId}
            onChange={(e) => onFilterChange({ queueId: e.target.value })}
            className="-sq-surface-sq-textPrimary focus:outline-none focus:border-sq-primary disabled:opacity-40"
          >
            <option value="">All Queues</option>
            {queues.map((q) => (
              <option key={q._id || q.id} value={q._id || q.id}>
                {q.name} ({q.prefix})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default ReviewFilters;
