import React, { useState, useEffect } from 'react';
import { Calendar, Filter, RotateCcw, AlertCircle, Building2, MapPin, Briefcase, Layers } from 'lucide-react';
import Button from '../../common/Button';
import adminOrgService from '../../../services/adminOrgService';
import adminCounterQueueService from '../../../services/adminCounterQueueService';

/**
 * Date Presets Helper Functions
 */
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

  return null;
};

/**
 * Filter Component for Date Ranges & Hierarchy Controls
 */
const AnalyticsFilters = ({ onApplyFilters, isLoading }) => {
  // Preset Selection state
  const [activePreset, setActivePreset] = useState('LAST_30_DAYS');

  // Date Inputs State
  const initialPreset = getPresetDates('LAST_30_DAYS');
  const [startDate, setStartDate] = useState(initialPreset.startDate);
  const [endDate, setEndDate] = useState(initialPreset.endDate);
  const [dateError, setDateError] = useState('');

  // Hierarchy Data Lists
  const [organizations, setOrganizations] = useState([]);
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [queues, setQueues] = useState([]);

  // Selected Hierarchy Values
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedLocId, setSelectedLocId] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedQueueId, setSelectedQueueId] = useState('');

  // Fetch Organizations on Mount
  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        const res = await adminOrgService.getOrganizations({ limit: 100 });
        const list = res.data?.organizations || [];
        setOrganizations(list);
      } catch (err) {
        console.error('Failed to load organizations for analytics filter:', err);
      }
    };
    loadOrganizations();
  }, []);

  // Cascade Load Locations when Org changes
  useEffect(() => {
    if (!selectedOrgId) {
      setLocations([]);
      setSelectedLocId('');
      setDepartments([]);
      setSelectedDeptId('');
      setQueues([]);
      setSelectedQueueId('');
      return;
    }

    const loadLocations = async () => {
      try {
        const res = await adminOrgService.getLocations(selectedOrgId);
        setLocations(res.data?.locations || []);
      } catch (err) {
        console.error('Failed to load locations:', err);
        setLocations([]);
      }
    };

    loadLocations();
    setSelectedLocId('');
    setDepartments([]);
    setSelectedDeptId('');
    setQueues([]);
    setSelectedQueueId('');
  }, [selectedOrgId]);

  // Cascade Load Departments when Loc changes
  useEffect(() => {
    if (!selectedOrgId || !selectedLocId) {
      setDepartments([]);
      setSelectedDeptId('');
      setQueues([]);
      setSelectedQueueId('');
      return;
    }

    const loadDepartments = async () => {
      try {
        const res = await adminOrgService.getDepartments(selectedOrgId, selectedLocId);
        setDepartments(res.data?.departments || []);
      } catch (err) {
        console.error('Failed to load departments:', err);
        setDepartments([]);
      }
    };

    loadDepartments();
    setSelectedDeptId('');
    setQueues([]);
    setSelectedQueueId('');
  }, [selectedOrgId, selectedLocId]);

  // Cascade Load Queues when Dept changes
  useEffect(() => {
    if (!selectedOrgId || !selectedLocId || !selectedDeptId) {
      setQueues([]);
      setSelectedQueueId('');
      return;
    }

    const loadQueues = async () => {
      try {
        const res = await adminCounterQueueService.getQueues(selectedOrgId, selectedLocId, selectedDeptId);
        setQueues(res.data?.queues || []);
      } catch (err) {
        console.error('Failed to load queues:', err);
        setQueues([]);
      }
    };

    loadQueues();
    setSelectedQueueId('');
  }, [selectedOrgId, selectedLocId, selectedDeptId]);

  // Handle Preset Click
  const handlePresetSelect = (presetKey) => {
    setActivePreset(presetKey);
    if (presetKey !== 'CUSTOM') {
      const dates = getPresetDates(presetKey);
      if (dates) {
        setStartDate(dates.startDate);
        setEndDate(dates.endDate);
        setDateError('');
      }
    }
  };

  // Date Change Handler with Validation
  const handleStartDateChange = (val) => {
    setStartDate(val);
    setActivePreset('CUSTOM');
    validateDates(val, endDate);
  };

  const handleEndDateChange = (val) => {
    setEndDate(val);
    setActivePreset('CUSTOM');
    validateDates(startDate, val);
  };

  const validateDates = (start, end) => {
    if (start && end && new Date(start) > new Date(end)) {
      setDateError('Start date cannot be after end date');
      return false;
    }
    setDateError('');
    return true;
  };

  // Submit/Apply Filters
  const handleApply = (e) => {
    if (e) e.preventDefault();
    if (!validateDates(startDate, endDate)) return;

    onApplyFilters({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      organizationId: selectedOrgId || undefined,
      locationId: selectedLocId || undefined,
      departmentId: selectedDeptId || undefined,
      queueId: selectedQueueId || undefined,
    });
  };

  // Reset Filters
  const handleReset = () => {
    const d = getPresetDates('LAST_30_DAYS');
    setActivePreset('LAST_30_DAYS');
    setStartDate(d.startDate);
    setEndDate(d.endDate);
    setDateError('');
    setSelectedOrgId('');
    setSelectedLocId('');
    setSelectedDeptId('');
    setSelectedQueueId('');

    onApplyFilters({
      startDate: d.startDate,
      endDate: d.endDate,
    });
  };

  return (
    <div className="bg-sq-surface p-5 rounded-2xl border border-sq-border space-y-5 shadow-lg">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-sq-border">
        {/* Date Preset Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
          <span className="text-xs font-bold text-sq-muted uppercase tracking-wider flex items-center gap-1.5 mr-2">
            <Calendar className="w-3.5 h-3.5" />
            Range:
          </span>

          {[
            { key: 'TODAY', label: 'Today' },
            { key: 'YESTERDAY', label: 'Yesterday' },
            { key: 'LAST_7_DAYS', label: 'Last 7 Days' },
            { key: 'LAST_30_DAYS', label: 'Last 30 Days' },
            { key: 'CUSTOM', label: 'Custom' },
          ].map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => handlePresetSelect(preset.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activePreset === preset.key
                  ? 'bg-sq-surfaceSecondary text-sq-textSecondary border border-sq-warning shadow-md shadow-sq-warning/10'
                  : 'bg-sq-surfaceSecondary text-sq-textSecondary border border-sq-border hover:text-sq-textPrimary'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Start & End Date Inputs */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-sq-textSecondary font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="bg-sq-surfaceSecondary text-xs text-sq-textPrimary rounded-xl px-3 py-1.5 border border-sq-border focus:outline-none focus:border-sq-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-sq-textSecondary font-medium">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="bg-sq-surfaceSecondary text-xs text-sq-textPrimary rounded-xl px-3 py-1.5 border border-sq-border focus:outline-none focus:border-sq-primary"
            />
          </div>
        </div>
      </div>

      {/* Date Validation Alert */}
      {dateError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{dateError}</span>
        </div>
      )}

      {/* Hierarchy Dropdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Organization Filter */}
        <div>
          <label className="block text-[11px] font-bold text-sq-muted uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-sq-info" />
            Organization
          </label>
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="w-full bg-sq-surfaceSecondary text-xs text-sq-textPrimary rounded-xl px-3 py-2 border border-sq-border focus:outline-none focus:border-sq-primary"
          >
            <option value="">All Organizations</option>
            {organizations.map((org) => (
              <option key={org._id} value={org._id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        {/* Location Filter */}
        <div>
          <label className="block text-[11px] font-bold text-sq-muted uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-sq-info" />
            Location
          </label>
          <select
            value={selectedLocId}
            onChange={(e) => setSelectedLocId(e.target.value)}
            disabled={!selectedOrgId}
            className={`w-full text-xs text-sq-textPrimary rounded-xl px-3 py-2 border border-sq-border focus:outline-none focus:border-sq-primary ${
              !selectedOrgId ? 'bg-sq-surfaceSecondary opacity-50 cursor-not-allowed' : 'bg-sq-surfaceSecondary'
            }`}
          >
            <option value="">All Locations</option>
            {locations.map((loc) => (
              <option key={loc._id} value={loc._id}>
                {loc.name} ({loc.city})
              </option>
            ))}
          </select>
        </div>

        {/* Department Filter */}
        <div>
          <label className="block text-[11px] font-bold text-sq-muted uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-sq-info" />
            Department
          </label>
          <select
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
            disabled={!selectedLocId}
            className={`w-full text-xs text-sq-textPrimary rounded-xl px-3 py-2 border border-sq-border focus:outline-none focus:border-sq-primary ${
              !selectedLocId ? 'bg-sq-surfaceSecondary opacity-50 cursor-not-allowed' : 'bg-sq-surfaceSecondary'
            }`}
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept._id} value={dept._id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        {/* Queue Filter */}
        <div>
          <label className="block text-[11px] font-bold text-sq-muted uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sq-info" />
            Queue
          </label>
          <select
            value={selectedQueueId}
            onChange={(e) => setSelectedQueueId(e.target.value)}
            disabled={!selectedDeptId}
            className={`w-full text-xs text-sq-textPrimary rounded-xl px-3 py-2 border border-sq-border focus:outline-none focus:border-sq-primary ${
              !selectedDeptId ? 'bg-sq-surfaceSecondary opacity-50 cursor-not-allowed' : 'bg-sq-surfaceSecondary'
            }`}
          >
            <option value="">All Queues</option>
            {queues.map((q) => (
              <option key={q._id} value={q._id}>
                {q.name} ({q.prefix})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleReset}
          className="flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Filters</span>
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={handleApply}
          isDisabled={isLoading || !!dateError}
          className="flex items-center gap-1.5"
        >
          <Filter className="w-3.5 h-3.5" />
          <span>Apply Filters</span>
        </Button>
      </div>
    </div>
  );
};

export default AnalyticsFilters;
