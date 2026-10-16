import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  MapPin,
  Briefcase,
  Plus,
  Edit3,
  Power,
  Search,
  SlidersHorizontal,
  RefreshCw,
  X,
  CheckCircle2,
  Clock,
  Layers,
  AlertTriangle,
  Monitor,
  ArrowLeft,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import SkeletonLoader from '../components/common/SkeletonLoader';
import EmptyState from '../components/common/EmptyState';
import Toast from '../components/common/Toast';
import adminOrgService from '../services/adminOrgService';
import adminAnalyticsService from '../services/adminAnalyticsService';
import CounterManagementPanel from '../components/CounterManagementPanel';
import QueueManagementPanel from '../components/QueueManagementPanel';

/**
 * SmartQueue Real Admin Operations & Organization Management Dashboard
 */
const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('organizations');
  const [overviewMetrics, setOverviewMetrics] = useState(null);

  // Organizations Data & Filter States
  const [organizations, setOrganizations] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1, limit: 10 });
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  const fetchOverviewMetrics = useCallback(async () => {
    try {
      const res = await adminAnalyticsService.getAnalyticsOverview();
      if (res?.success) {
        setOverviewMetrics(res.data);
      }
    } catch (err) {
      console.warn('Failed to load analytics overview for dashboard:', err.message);
    }
  }, []);

  useEffect(() => {
    fetchOverviewMetrics();
  }, [fetchOverviewMetrics]);

  // Loading & Toast States
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Modals & Drawers States
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null); // null = Create, object = Edit
  const [orgFormData, setOrgFormData] = useState({
    name: '',
    description: '',
    slug: '',
    category: 'HOSPITAL',
    logo: '',
    banner: '',
    isActive: true,
  });
  const [formError, setFormError] = useState('');

  // Status Confirmation Modal State
  const [statusModalItem, setStatusModalItem] = useState(null); // { type: 'org'|'loc'|'dept', item }

  // Location Drawer / Modal States
  const [selectedOrgForLoc, setSelectedOrgForLoc] = useState(null);
  const [locations, setLocations] = useState([]);
  const [isLocModalOpen, setIsLocModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState(null);
  const [locFormData, setLocFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    phone: '',
    isActive: true,
  });

  // Department Modal States
  const [selectedLocForDept, setSelectedLocForDept] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptFormData, setDeptFormData] = useState({
    name: '',
    description: '',
    prefix: 'A',
    avgServiceTimeMins: 15,
    isActive: true,
  });

  // Department Counter & Queue Operations States
  const [selectedDeptForOps, setSelectedDeptForOps] = useState(null);
  const [deptOpsTab, setDeptOpsTab] = useState('counters'); // 'counters' | 'queues'

  const categories = [
    { label: 'All Categories', value: 'ALL' },
    { label: 'Hospitals', value: 'HOSPITAL' },
    { label: 'Banks', value: 'BANK' },
    { label: 'Government', value: 'GOVERNMENT' },
    { label: 'Colleges', value: 'COLLEGE' },
    { label: 'Salons', value: 'SALON' },
    { label: 'Restaurants', value: 'RESTAURANT' },
    { label: 'Service Centers', value: 'SERVICE_CENTER' },
    { label: 'Other', value: 'OTHER' },
  ];

  // Fetch Organizations list for Admin
  const fetchAdminOrganizations = useCallback(async () => {
    setIsLoading(true);
    setFormError('');
    try {
      const res = await adminOrgService.getOrganizations({
        search: searchTerm.trim() || undefined,
        category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        page,
        limit: 10,
      });
      setOrganizations(res.data.organizations);
      setPagination(res.data.pagination);
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'Failed to fetch admin organizations.' });
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, categoryFilter, statusFilter, page]);

  useEffect(() => {
    fetchAdminOrganizations();
  }, [fetchAdminOrganizations]);

  // Open Create Org Modal
  const handleOpenCreateOrg = () => {
    setEditingOrg(null);
    setOrgFormData({
      name: '',
      description: '',
      slug: '',
      category: 'HOSPITAL',
      logo: '',
      banner: '',
      isActive: true,
    });
    setFormError('');
    setIsOrgModalOpen(true);
  };

  // Open Edit Org Modal
  const handleOpenEditOrg = (org) => {
    setEditingOrg(org);
    setOrgFormData({
      name: org.name,
      description: org.description,
      slug: org.slug,
      category: org.category,
      logo: org.logo || '',
      banner: org.banner || '',
      isActive: org.isActive,
    });
    setFormError('');
    setIsOrgModalOpen(true);
  };

  // Auto-generate slug from name
  const handleNameChange = (e) => {
    const val = e.target.value;
    setOrgFormData((prev) => ({
      ...prev,
      name: val,
      slug: editingOrg ? prev.slug : val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    }));
  };

  // Submit Create/Edit Org
  const handleOrgFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);
    try {
      if (editingOrg) {
        await adminOrgService.updateOrganization(editingOrg._id, orgFormData);
        setToastMessage({ type: 'success', text: 'Organization updated successfully!' });
      } else {
        await adminOrgService.createOrganization(orgFormData);
        setToastMessage({ type: 'success', text: 'Organization created successfully!' });
      }
      setIsOrgModalOpen(false);
      fetchAdminOrganizations();
    } catch (err) {
      setFormError(err.message || 'Failed to save organization.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Org Status
  const handleToggleOrgStatus = async (org) => {
    try {
      const res = await adminOrgService.toggleOrganizationStatus(org._id);
      setToastMessage({ type: 'info', text: res.message });
      setStatusModalItem(null);
      fetchAdminOrganizations();
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'Failed to toggle status.' });
    }
  };

  // Manage Locations for selected org
  const handleOpenLocationManager = async (org) => {
    setSelectedOrgForLoc(org);
    setSelectedLocForDept(null);
    setDepartments([]);
    fetchLocationsForOrg(org._id);
  };

  const fetchLocationsForOrg = async (orgId) => {
    try {
      const res = await adminOrgService.getLocations(orgId);
      setLocations(res.data.locations);
    } catch (err) {
      setToastMessage({ type: 'error', text: 'Failed to load locations.' });
    }
  };

  // Open Create/Edit Location Modal
  const handleOpenCreateLoc = () => {
    setEditingLoc(null);
    setLocFormData({ name: '', address: '', city: '', state: '', postalCode: '', phone: '', isActive: true });
    setIsLocModalOpen(true);
  };

  const handleOpenEditLoc = (loc) => {
    setEditingLoc(loc);
    setLocFormData({
      name: loc.name,
      address: loc.address,
      city: loc.city,
      state: loc.state || '',
      postalCode: loc.postalCode || '',
      phone: loc.phone || '',
      isActive: loc.isActive,
    });
    setIsLocModalOpen(true);
  };

  const handleLocFormSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrgForLoc) return;
    setIsSubmitting(true);
    try {
      if (editingLoc) {
        await adminOrgService.updateLocation(selectedOrgForLoc._id, editingLoc._id, locFormData);
        setToastMessage({ type: 'success', text: 'Location updated successfully!' });
      } else {
        await adminOrgService.createLocation(selectedOrgForLoc._id, locFormData);
        setToastMessage({ type: 'success', text: 'Location created successfully!' });
      }
      setIsLocModalOpen(false);
      fetchLocationsForOrg(selectedOrgForLoc._id);
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'Failed to save location.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLocStatus = async (loc) => {
    try {
      const res = await adminOrgService.toggleLocationStatus(selectedOrgForLoc._id, loc._id);
      setToastMessage({ type: 'info', text: res.message });
      fetchLocationsForOrg(selectedOrgForLoc._id);
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'Failed to toggle location status.' });
    }
  };

  // Manage Departments for selected location
  const handleSelectLocationForDepts = async (loc) => {
    setSelectedLocForDept(loc);
    setSelectedDeptForOps(null);
    fetchDepartmentsForLoc(selectedOrgForLoc._id, loc._id);
  };

  const fetchDepartmentsForLoc = async (orgId, locId) => {
    try {
      const res = await adminOrgService.getDepartments(orgId, locId);
      setDepartments(res.data.departments);
    } catch (err) {
      setToastMessage({ type: 'error', text: 'Failed to load departments.' });
    }
  };

  const handleOpenCreateDept = () => {
    setEditingDept(null);
    setDeptFormData({ name: '', description: '', prefix: 'A', avgServiceTimeMins: 15, isActive: true });
    setIsDeptModalOpen(true);
  };

  const handleOpenEditDept = (dept) => {
    setEditingDept(dept);
    setDeptFormData({
      name: dept.name,
      description: dept.description || '',
      prefix: dept.prefix || 'A',
      avgServiceTimeMins: dept.avgServiceTimeMins || 15,
      isActive: dept.isActive,
    });
    setIsDeptModalOpen(true);
  };

  const handleDeptFormSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrgForLoc || !selectedLocForDept) return;
    setIsSubmitting(true);
    try {
      if (editingDept) {
        await adminOrgService.updateDepartment(
          selectedOrgForLoc._id,
          selectedLocForDept._id,
          editingDept._id,
          deptFormData
        );
        setToastMessage({ type: 'success', text: 'Department updated successfully!' });
      } else {
        await adminOrgService.createDepartment(
          selectedOrgForLoc._id,
          selectedLocForDept._id,
          deptFormData
        );
        setToastMessage({ type: 'success', text: 'Department created successfully!' });
      }
      setIsDeptModalOpen(false);
      fetchDepartmentsForLoc(selectedOrgForLoc._id, selectedLocForDept._id);
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'Failed to save department.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleDeptStatus = async (dept) => {
    try {
      const res = await adminOrgService.toggleDepartmentStatus(
        selectedOrgForLoc._id,
        selectedLocForDept._id,
        dept._id
      );
      setToastMessage({ type: 'info', text: res.message });
      fetchDepartmentsForLoc(selectedOrgForLoc._id, selectedLocForDept._id);
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'Failed to toggle department status.' });
    }
  };

  return (
    <MainLayout roleTitle="Admin Operations Center">
      <div className="space-y-8">
        {/* Toast Alert */}
        {toastMessage && (
          <Toast
            type={toastMessage.type}
            message={toastMessage.text}
            onClose={() => setToastMessage(null)}
          />
        )}

        {/* Admin Dashboard Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-sq-textPrimary tracking-tight">
              Admin Management Console
            </h1>
            <p className="text-xs text-sq-textSecondary mt-1">
              Configure organizations, branch locations, service departments, counters, and staff assignments.
            </p>
          </div>
          <Button variant="primary" icon={Plus} onClick={handleOpenCreateOrg}>
            New Organization
          </Button>
        </div>

        {/* Real-Time Operational Overview KPIs */}
        {overviewMetrics && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card variant="surface" className="p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-sq-muted uppercase tracking-wider">Organizations</span>
              <div className="text-xl font-extrabold text-sq-textPrimary">{pagination.total || organizations.length}</div>
              <span className="text-[10px] text-sq-textSecondary">Active entities</span>
            </Card>
            <Card variant="surface" className="p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-sq-muted uppercase tracking-wider">Currently Waiting</span>
              <div className="text-xl font-extrabold text-sq-primary">{overviewMetrics.currentlyWaiting || 0}</div>
              <span className="text-[10px] text-sq-textSecondary">Live queue load</span>
            </Card>
            <Card variant="surface" className="p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-sq-muted uppercase tracking-wider">In Service</span>
              <div className="text-xl font-extrabold text-[#B27BDD]">{overviewMetrics.currentlyServing || 0}</div>
              <span className="text-[10px] text-sq-textSecondary">Active counters</span>
            </Card>
            <Card variant="surface" className="p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-sq-muted uppercase tracking-wider">Completed</span>
              <div className="text-xl font-extrabold text-sq-success">{overviewMetrics.completed || 0}</div>
              <span className="text-[10px] text-sq-textSecondary">{overviewMetrics.completionRate || 0}% rate</span>
            </Card>
            <Card variant="surface" className="p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-sq-muted uppercase tracking-wider">Avg Wait Time</span>
              <div className="text-xl font-extrabold text-sq-info">{overviewMetrics.averageWaitMinutes || 0}m</div>
              <span className="text-[10px] text-sq-textSecondary">Customer wait</span>
            </Card>
            <Card variant="surface" className="p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-sq-muted uppercase tracking-wider">Total Visitors</span>
              <div className="text-xl font-extrabold text-sq-textPrimary">{overviewMetrics.totalVisitors || 0}</div>
              <span className="text-[10px] text-sq-textSecondary">{overviewMetrics.totalEntries || 0} tickets</span>
            </Card>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex bg-sq-surface p-1 rounded-2xl border border-sq-border overflow-x-auto">
          {[
            { id: 'organizations', label: 'Organizations', icon: Building2 },
            { id: 'locations', label: 'Locations & Services', icon: MapPin },
          ].map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-sq-surfaceSecondary text-sq-primary shadow-md shadow-pink-500/5'
                    : 'text-sq-textSecondary hover:text-sq-textPrimary'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: ORGANIZATION MANAGEMENT */}
        {activeTab === 'organizations' && (
          <div className="space-y-6">
            {/* Filter & Search Bar */}
            <Card variant="surface" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-sq-muted" />
                <input
                  type="text"
                  placeholder="Search by name, description or slug..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-sq-surfaceSecondary text-xs text-sq-textPrimary placeholder-sq-muted rounded-xl pl-10 pr-4 py-2 border border-sq-border focus:outline-none focus:border-sq-primary"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(1);
                  }}
                  className="bg-sq-surfaceSecondary text-xs text-sq-textPrimary rounded-xl px-3 py-2 border border-sq-border focus:outline-none focus:border-sq-primary"
                >
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="bg-sq-surfaceSecondary text-xs text-sq-textPrimary rounded-xl px-3 py-2 border border-sq-border focus:outline-none focus:border-sq-primary"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="INACTIVE">Inactive Only</option>
                </select>
              </div>
            </Card>

            {/* Organization Table */}
            {isLoading ? (
              <SkeletonLoader variant="table" count={5} />
            ) : organizations.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No Organizations Found"
                description="No organizations match your current search parameters."
                actionLabel="Add Organization"
                onAction={handleOpenCreateOrg}
              />
            ) : (
              <Card variant="surface" className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-sq-border text-sq-muted uppercase text-[10px]">
                      <th className="pb-3 font-semibold">Organization</th>
                      <th className="pb-3 font-semibold">Category</th>
                      <th className="pb-3 font-semibold">Slug</th>
                      <th className="pb-3 font-semibold text-center">Status</th>
                      <th className="pb-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {organizations.map((org) => (
                      <tr key={org._id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 font-semibold text-sq-textPrimary">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-sq-surfaceSecondary text-sq-primary flex items-center justify-center font-bold text-xs">
                              <Building2 className="w-4 h-4" />
                            </div>
                            <div>
                              <span>{org.name}</span>
                              <span className="text-[10px] text-sq-muted block line-clamp-1 max-w-xs">
                                {org.description}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-sq-textSecondary font-semibold">{org.category}</td>
                        <td className="py-3 text-sq-muted font-mono">{org.slug}</td>
                        <td className="py-3 text-center">
                          <Badge variant={org.isActive ? 'success' : 'danger'} size="sm" dot>
                            {org.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </Badge>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                handleOpenLocationManager(org);
                                setActiveTab('locations');
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-sq-infoBg text-sq-info hover:bg-sq-infoBg rounded-lg transition-colors"
                            >
                              Locations
                            </button>

                            <button
                              onClick={() => handleOpenEditOrg(org)}
                              className="p-1.5 text-sq-textSecondary hover:text-sq-textPrimary hover:bg-sq-surfaceSecondary rounded-lg transition-colors"
                              title="Edit Organization"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => setStatusModalItem({ type: 'org', item: org })}
                              className={`p-1.5 rounded-lg transition-colors ${
                                org.isActive
                                  ? 'text-red-400 hover:bg-red-500/10'
                                  : 'text-emerald-400 hover:bg-emerald-500/10'
                              }`}
                              title={org.isActive ? 'Deactivate Organization' : 'Reactivate Organization'}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination Controls */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t border-sq-border mt-4">
                    <span className="text-xs text-sq-textSecondary">
                      Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        isDisabled={page <= 1}
                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        isDisabled={page >= pagination.totalPages}
                        onClick={() => setPage((prev) => prev + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {/* TAB 2: LOCATION & DEPARTMENT MANAGEMENT */}
        {activeTab === 'locations' && (
          <div className="space-y-6">
            {!selectedOrgForLoc ? (
              <EmptyState
                icon={Building2}
                title="Select an Organization"
                description="Please select an organization from the Organizations tab to manage its locations and department services."
                actionLabel="View Organizations"
                onAction={() => setActiveTab('organizations')}
              />
            ) : (
              <div className="space-y-6">
                {/* Org Header Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-sq-surface p-5 rounded-2xl border border-sq-border">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-sq-info tracking-wider">
                      Managing Locations & Services
                    </span>
                    <h2 className="text-xl font-bold text-sq-textPrimary">{selectedOrgForLoc.name}</h2>
                  </div>
                  <Button variant="primary" size="sm" icon={Plus} onClick={handleOpenCreateLoc}>
                    Add Location
                  </Button>
                </div>

                {/* Locations Stream */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Locations List (Left Column) */}
                  <Card variant="surface" className="space-y-3">
                    <h3 className="text-sm font-bold text-sq-textPrimary">
                      Locations ({locations.length})
                    </h3>

                    {locations.length === 0 ? (
                      <p className="text-xs text-sq-muted py-4 text-center">No locations added yet.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {locations.map((loc) => {
                          const isSelected = selectedLocForDept?._id === loc._id;
                          return (
                            <div
                              key={loc._id}
                              onClick={() => handleSelectLocationForDepts(loc)}
                              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-sq-surfaceSecondary border-sq-borderStrong'
                                  : 'bg-sq-surfaceSecondary border-sq-border hover:border-sq-border'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-sq-textPrimary">{loc.name}</h4>
                                <Badge variant={loc.isActive ? 'success' : 'danger'} size="sm">
                                  {loc.isActive ? 'ACTIVE' : 'INACTIVE'}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-sq-textSecondary mt-1">{loc.address}, {loc.city}</p>

                              <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-sq-border">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditLoc(loc);
                                  }}
                                  className="text-[11px] text-sq-info hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleLocStatus(loc);
                                  }}
                                  className={`text-[11px] ${loc.isActive ? 'text-red-400' : 'text-emerald-400'} hover:underline`}
                                >
                                  {loc.isActive ? 'Deactivate' : 'Reactivate'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>

                  {/* Departments, Counters & Queues Panel (Right 2 Columns) */}
                  <Card variant="surface" className="lg:col-span-2 space-y-4">
                    {selectedDeptForOps ? (
                      /* Department Operations View (Counters & Queues) */
                      <div className="space-y-4">
                        {/* Header & Back Button */}
                        <div className="flex items-center justify-between pb-3 border-b border-sq-border">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setSelectedDeptForOps(null)}
                              className="p-1.5 bg-sq-surfaceSecondary hover:bg-sq-surfaceSecondary text-sq-textSecondary hover:text-sq-textPrimary rounded-lg transition-colors"
                              title="Back to Departments"
                            >
                              <ArrowLeft className="w-4 h-4" />
                            </button>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-sq-textPrimary">
                                  {selectedDeptForOps.name}
                                </h3>
                                <span className="text-[10px] text-sq-info font-mono px-1.5 py-0.5 rounded bg-sq-infoBg">
                                  Prefix: {selectedDeptForOps.prefix || 'A'}
                                </span>
                              </div>
                              <p className="text-xs text-sq-textSecondary">
                                Operations setup for {selectedOrgForLoc?.name} — {selectedLocForDept?.name}
                              </p>
                            </div>
                          </div>

                          {/* Sub-tab Switcher: Counters vs Queues */}
                          <div className="flex bg-sq-surfaceSecondary p-1 rounded-xl border border-sq-border">
                            <button
                              onClick={() => setDeptOpsTab('counters')}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                deptOpsTab === 'counters'
                                  ? 'bg-sq-surfaceSecondary text-sq-primary'
                                  : 'text-sq-textSecondary hover:text-sq-textPrimary'
                              }`}
                            >
                              <Monitor className="w-3.5 h-3.5" />
                              <span>Counters</span>
                            </button>
                            <button
                              onClick={() => setDeptOpsTab('queues')}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                deptOpsTab === 'queues'
                                  ? 'bg-sq-surfaceSecondary text-sq-primary'
                                  : 'text-sq-textSecondary hover:text-sq-textPrimary'
                              }`}
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span>Queues</span>
                            </button>
                          </div>
                        </div>

                        {/* Active Operations Panel */}
                        {deptOpsTab === 'counters' ? (
                          <CounterManagementPanel
                            organizationId={selectedOrgForLoc._id}
                            locationId={selectedLocForDept._id}
                            departmentId={selectedDeptForOps._id}
                            departmentName={selectedDeptForOps.name}
                            setToast={setToastMessage}
                          />
                        ) : (
                          <QueueManagementPanel
                            organizationId={selectedOrgForLoc._id}
                            locationId={selectedLocForDept._id}
                            departmentId={selectedDeptForOps._id}
                            departmentName={selectedDeptForOps.name}
                            setToast={setToastMessage}
                          />
                        )}
                      </div>
                    ) : (
                      /* Standard Departments List */
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-base font-bold text-sq-textPrimary">
                              Departments & Services
                            </h3>
                            <p className="text-xs text-sq-textSecondary">
                              {selectedLocForDept
                                ? `At ${selectedLocForDept.name} (${selectedLocForDept.city})`
                                : 'Select a location on the left to manage services'}
                            </p>
                          </div>

                          {selectedLocForDept && (
                            <Button variant="secondary" size="sm" icon={Plus} onClick={handleOpenCreateDept}>
                              Add Department
                            </Button>
                          )}
                        </div>

                        {!selectedLocForDept ? (
                          <EmptyState
                            icon={MapPin}
                            title="Select Location"
                            description="Click on a location on the left panel to manage its departments and services."
                          />
                        ) : departments.length === 0 ? (
                          <EmptyState
                            icon={Briefcase}
                            title="No Departments"
                            description="No departments exist at this location yet."
                            actionLabel="Add Department"
                            onAction={handleOpenCreateDept}
                          />
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {departments.map((dept) => (
                              <div
                                key={dept._id}
                                className="p-4 bg-sq-surfaceSecondary rounded-xl border border-sq-border space-y-3"
                              >
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className="text-sm font-bold text-sq-textPrimary">{dept.name}</h4>
                                    <span className="text-[10px] text-sq-info font-mono">
                                      Prefix: {dept.prefix || 'A'}
                                    </span>
                                  </div>
                                  <Badge variant={dept.isActive ? 'success' : 'danger'} size="sm">
                                    {dept.isActive ? 'ACTIVE' : 'INACTIVE'}
                                  </Badge>
                                </div>

                                <p className="text-xs text-sq-textSecondary">{dept.description || 'No description provided.'}</p>

                                <div className="flex flex-col gap-2 pt-2 border-t border-sq-border">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-sq-muted">
                                      Avg Service: {dept.avgServiceTimeMins} mins
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleOpenEditDept(dept)}
                                        className="text-sq-info hover:underline font-semibold"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => handleToggleDeptStatus(dept)}
                                        className={`${dept.isActive ? 'text-red-400' : 'text-emerald-400'} hover:underline font-semibold`}
                                      >
                                        {dept.isActive ? 'Deactivate' : 'Reactivate'}
                                      </button>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => {
                                      setSelectedDeptForOps(dept);
                                      setDeptOpsTab('counters');
                                    }}
                                    className="w-full py-1.5 text-xs font-semibold bg-sq-primarySubtle text-sq-primary hover:bg-sq-primarySubtle rounded-lg transition-colors flex items-center justify-center gap-1.5"
                                  >
                                    <Monitor className="w-3.5 h-3.5" /> Manage Counters & Queues
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CREATE / EDIT ORGANIZATION MODAL */}
      <Modal
        isOpen={isOrgModalOpen}
        onClose={() => setIsOrgModalOpen(false)}
        title={editingOrg ? 'Edit Organization' : 'Create Organization'}
        subtitle="Manage public organization listing and details"
      >
        <form onSubmit={handleOrgFormSubmit} className="space-y-4">
          {formError && <p className="text-xs text-red-400 bg-red-950/80 p-2.5 rounded-xl border border-red-500/30">{formError}</p>}

          <Input
            label="Organization Name *"
            value={orgFormData.name}
            onChange={handleNameChange}
            placeholder="e.g. Metro Health Hospital"
            required
          />

          <Input
            label="Slug (URL identifier) *"
            value={orgFormData.slug}
            onChange={(e) => setOrgFormData({ ...orgFormData, slug: e.target.value })}
            placeholder="e.g. metro-health"
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-sq-textSecondary">Category *</label>
            <select
              value={orgFormData.category}
              onChange={(e) => setOrgFormData({ ...orgFormData, category: e.target.value })}
              className="w-full bg-sq-surfaceSecondary text-xs text-sq-textPrimary rounded-xl px-4 py-2.5 border border-sq-border focus:outline-none focus:border-sq-primary"
            >
              {categories.filter((c) => c.value !== 'ALL').map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-sq-textSecondary">Description *</label>
            <textarea
              value={orgFormData.description}
              onChange={(e) => setOrgFormData({ ...orgFormData, description: e.target.value })}
              rows={3}
              placeholder="Multi-specialty healthcare and diagnostics facility..."
              className="w-full bg-sq-surfaceSecondary text-xs text-sq-textPrimary placeholder-sq-muted rounded-xl p-3 border border-sq-border focus:outline-none focus:border-sq-primary"
              required
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <label className="flex items-center gap-2 text-xs text-sq-textPrimary cursor-pointer">
              <input
                type="checkbox"
                checked={orgFormData.isActive}
                onChange={(e) => setOrgFormData({ ...orgFormData, isActive: e.target.checked })}
                className="rounded bg-sq-surfaceSecondary border-sq-border text-sq-primary"
              />
              Active Organization (Visible in customer discovery)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-sq-border">
            <Button variant="ghost" size="sm" onClick={() => setIsOrgModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              {editingOrg ? 'Save Changes' : 'Create Organization'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* STATUS TOGGLE CONFIRMATION MODAL */}
      <Modal
        isOpen={!!statusModalItem}
        onClose={() => setStatusModalItem(null)}
        title={statusModalItem?.item?.isActive ? 'Deactivate Organization?' : 'Reactivate Organization?'}
        subtitle="Confirm operational status change"
      >
        <div className="space-y-4 py-2">
          <p className="text-xs text-sq-textSecondary leading-relaxed">
            {statusModalItem?.item?.isActive
              ? 'Deactivating this organization will immediately hide it and its services from public Customer Discovery.'
              : 'Reactivating will restore public visibility in Customer Discovery.'}
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setStatusModalItem(null)}>
              Cancel
            </Button>
            <Button
              variant={statusModalItem?.item?.isActive ? 'danger' : 'success'}
              size="sm"
              onClick={() => handleToggleOrgStatus(statusModalItem.item)}
            >
              Confirm {statusModalItem?.item?.isActive ? 'Deactivate' : 'Reactivate'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* CREATE / EDIT LOCATION MODAL */}
      <Modal
        isOpen={isLocModalOpen}
        onClose={() => setIsLocModalOpen(false)}
        title={editingLoc ? 'Edit Location' : 'Add Location'}
        subtitle={`Under ${selectedOrgForLoc?.name}`}
      >
        <form onSubmit={handleLocFormSubmit} className="space-y-4">
          <Input
            label="Location Name *"
            value={locFormData.name}
            onChange={(e) => setLocFormData({ ...locFormData, name: e.target.value })}
            placeholder="e.g. Pune Central Branch"
            required
          />
          <Input
            label="Address *"
            value={locFormData.address}
            onChange={(e) => setLocFormData({ ...locFormData, address: e.target.value })}
            placeholder="e.g. 102 Station Road"
            required
          />
          <Input
            label="City *"
            value={locFormData.city}
            onChange={(e) => setLocFormData({ ...locFormData, city: e.target.value })}
            placeholder="e.g. Pune"
            required
          />
          <Input
            label="Phone"
            value={locFormData.phone}
            onChange={(e) => setLocFormData({ ...locFormData, phone: e.target.value })}
            placeholder="e.g. +91 20 5551 0100"
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-sq-border">
            <Button variant="ghost" size="sm" onClick={() => setIsLocModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              {editingLoc ? 'Save Location' : 'Add Location'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* CREATE / EDIT DEPARTMENT MODAL */}
      <Modal
        isOpen={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        title={editingDept ? 'Edit Department' : 'Add Department'}
        subtitle={`Under ${selectedLocForDept?.name}`}
      >
        <form onSubmit={handleDeptFormSubmit} className="space-y-4">
          <Input
            label="Department Name *"
            value={deptFormData.name}
            onChange={(e) => setDeptFormData({ ...deptFormData, name: e.target.value })}
            placeholder="e.g. Cardiology OPD"
            required
          />
          <Input
            label="Prefix *"
            value={deptFormData.prefix}
            onChange={(e) => setDeptFormData({ ...deptFormData, prefix: e.target.value })}
            placeholder="e.g. CARD"
            required
          />
          <Input
            label="Average Service Time (Mins) *"
            type="number"
            value={deptFormData.avgServiceTimeMins}
            onChange={(e) => setDeptFormData({ ...deptFormData, avgServiceTimeMins: e.target.value })}
            placeholder="15"
            required
          />
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-sq-textSecondary">Description</label>
            <textarea
              value={deptFormData.description}
              onChange={(e) => setDeptFormData({ ...deptFormData, description: e.target.value })}
              rows={2}
              placeholder="Heart specialist consultation..."
              className="w-full bg-sq-surfaceSecondary text-xs text-sq-textPrimary placeholder-sq-muted rounded-xl p-3 border border-sq-border focus:outline-none focus:border-sq-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-sq-border">
            <Button variant="ghost" size="sm" onClick={() => setIsDeptModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              {editingDept ? 'Save Department' : 'Add Department'}
            </Button>
          </div>
        </form>
      </Modal>
    </MainLayout>
  );
};

export default AdminDashboard;
