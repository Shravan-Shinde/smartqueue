import React, { useState, useEffect } from 'react';
import { Filter, Search, RotateCcw, Building2, MapPin, Briefcase } from 'lucide-react';
import Button from '../../common/Button';
import adminOrgService from '../../../services/adminOrgService';

/**
 * Filter Bar component for Live Crowd Dashboard
 */
const LiveFilters = ({ onFilterChange, searchTerm, onSearchChange, isLoading }) => {
  // Hierarchy Lists
  const [organizations, setOrganizations] = useState([]);
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Selected Values
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedLocId, setSelectedLocId] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [crowdFilter, setCrowdFilter] = useState('ALL'); // 'ALL' | 'HIGH_ONLY' | 'OPEN_ONLY'

  // Fetch Organizations on Mount
  useEffect(() => {
    const loadOrgs = async () => {
      try {
        const res = await adminOrgService.getOrganizations({ limit: 100 });
        setOrganizations(res.data?.organizations || []);
      } catch (err) {
        console.error('Failed to load organizations for live filter:', err);
      }
    };
    loadOrgs();
  }, []);

  // Cascade Locations on Org Change
  useEffect(() => {
    if (!selectedOrgId) {
      setLocations([]);
      setSelectedLocId('');
      setDepartments([]);
      setSelectedDeptId('');
      notifyParent('', '', '', crowdFilter);
      return;
    }

    const loadLocs = async () => {
      try {
        const res = await adminOrgService.getLocations(selectedOrgId);
        setLocations(res.data?.locations || []);
      } catch (err) {
        setLocations([]);
      }
    };

    loadLocs();
    setSelectedLocId('');
    setDepartments([]);
    setSelectedDeptId('');
    notifyParent(selectedOrgId, '', '', crowdFilter);
  }, [selectedOrgId]);

  // Cascade Departments on Loc Change
  useEffect(() => {
    if (!selectedOrgId || !selectedLocId) {
      setDepartments([]);
      setSelectedDeptId('');
      notifyParent(selectedOrgId, '', '', crowdFilter);
      return;
    }

    const loadDepts = async () => {
      try {
        const res = await adminOrgService.getDepartments(selectedOrgId, selectedLocId);
        setDepartments(res.data?.departments || []);
      } catch (err) {
        setDepartments([]);
      }
    };

    loadDepts();
    setSelectedDeptId('');
    notifyParent(selectedOrgId, selectedLocId, '', crowdFilter);
  }, [selectedOrgId, selectedLocId]);

  const handleDeptChange = (deptId) => {
    setSelectedDeptId(deptId);
    notifyParent(selectedOrgId, selectedLocId, deptId, crowdFilter);
  };

  const handleCrowdFilterChange = (val) => {
    setCrowdFilter(val);
    notifyParent(selectedOrgId, selectedLocId, selectedDeptId, val);
  };

  const notifyParent = (orgId, locId, deptId, filterType) => {
    onFilterChange({
      organizationId: orgId || undefined,
      locationId: locId || undefined,
      departmentId: deptId || undefined,
      crowdFilter: filterType,
    });
  };

  const handleReset = () => {
    setSelectedOrgId('');
    setSelectedLocId('');
    setSelectedDeptId('');
    setCrowdFilter('ALL');
    onSearchChange('');
    onFilterChange({ crowdFilter: 'ALL' });
  };

  return (
    <div className="bg-sq-surface p-5 rounded-2xl border border-sq-border shadow-lg space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Search Queue Name */}
        <div className="lg:col-span-1">
          <label className="block text-[11px] font-bold text-sq-muted uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-sq-primary" />
            Search Queue
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search by queue name..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-sq-surfaceSecondary text-xs text-sq-textPrimary placeholder-sq-muted rounded-xl px-3 py-2 border border-sq-border focus:outline-none focus:border-sq-primary"
            />
          </div>
        </div>

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
            onChange={(e) => handleDeptChange(e.target.value)}
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

        {/* Crowd Focus Filter */}
        <div>
          <label className="block text-[11px] font-bold text-sq-muted uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-sq-info" />
            Focus View
          </label>
          <div className="flex items-center gap-2">
            <select
              value={crowdFilter}
              onChange={(e) => handleCrowdFilterChange(e.target.value)}
              className="w-full bg-sq-surfaceSecondary text-xs text-sq-textPrimary rounded-xl px-3 py-2 border border-sq-border focus:outline-none focus:border-sq-primary"
            >
              <option value="ALL">All Live Queues</option>
              <option value="HIGH_ONLY">High/Very High Crowd Only</option>
              <option value="OPEN_ONLY">Open Queues Only</option>
            </select>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleReset}
              title="Reset Filters"
              className="p-2 shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveFilters;
