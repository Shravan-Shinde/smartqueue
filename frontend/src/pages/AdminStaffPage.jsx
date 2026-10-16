import React, { useState, useEffect } from 'react';
import { UserPlus, Search, Building2, MapPin, Briefcase, Hash } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import api from '../services/api';
import Toast from '../components/common/Toast';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';

const AdminStaffPage = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    organizationId: '',
    locationId: '',
    departmentId: '',
    counterId: ''
  });
  
  const [organizations, setOrganizations] = useState([]);
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [counters, setCounters] = useState([]);

  useEffect(() => {
    fetchStaff();
    fetchOrganizations();
  }, []);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/staff');
      if (res.data.success) {
        setStaff(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load staff accounts');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const res = await api.get('/admin/organizations');
      if (res.data.success) {
        setOrganizations(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLocations = async (orgId) => {
    try {
      const res = await api.get(`/admin/organizations/${orgId}/locations`);
      if (res.data.success) {
        setLocations(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDepartments = async (orgId, locId) => {
    try {
      const res = await api.get(`/admin/organizations/${orgId}/locations/${locId}/departments`);
      if (res.data.success) {
        setDepartments(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCounters = async (orgId, locId, depId) => {
    try {
      const res = await api.get(`/admin/organizations/${orgId}/locations/${locId}/departments/${depId}/counters`);
      if (res.data.success) {
        setCounters(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOrgChange = (e) => {
    const orgId = e.target.value;
    setFormData(prev => ({ ...prev, organizationId: orgId, locationId: '', departmentId: '', counterId: '' }));
    if (orgId) fetchLocations(orgId);
    setLocations([]);
    setDepartments([]);
    setCounters([]);
  };

  const handleLocChange = (e) => {
    const locId = e.target.value;
    setFormData(prev => ({ ...prev, locationId: locId, departmentId: '', counterId: '' }));
    if (locId) fetchDepartments(formData.organizationId, locId);
    setDepartments([]);
    setCounters([]);
  };

  const handleDepChange = (e) => {
    const depId = e.target.value;
    setFormData(prev => ({ ...prev, departmentId: depId, counterId: '' }));
    if (depId) fetchCounters(formData.organizationId, formData.locationId, depId);
    setCounters([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      const res = await api.post('/admin/staff', formData);
      if (res.data.success) {
        setSuccess('Staff account created successfully!');
        setShowModal(false);
        setFormData({ name: '', email: '', password: '', organizationId: '', locationId: '', departmentId: '', counterId: '' });
        fetchStaff();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create staff account');
    }
  };

  const handleToggleStatus = async (staffId) => {
    try {
      const res = await api.patch(`/admin/staff/${staffId}/status`);
      if (res.data.success) {
        setSuccess(res.data.message || 'Staff status updated');
        fetchStaff();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update staff status');
    }
  };

  return (
    <MainLayout roleTitle="Staff Management">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-sq-textPrimary tracking-tight">Staff Management</h1>
            <p className="text-sm text-sq-textSecondary mt-1">Create and manage staff accounts across your organization.</p>
          </div>
          <Button variant="primary" onClick={() => setShowModal(true)} className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            <span>Add Staff</span>
          </Button>
        </div>

        {(error || success) && (
          <Toast type={error ? 'error' : 'success'} message={error || success} onClose={() => { setError(''); setSuccess(''); }} />
        )}

        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-sq-border rounded-xl w-full"></div>
            <div className="h-12 bg-sq-border rounded-xl w-full"></div>
          </div>
        ) : staff.length === 0 ? (
          <EmptyState icon={UserPlus} title="No staff members found" description="Create a staff account to get started." />
        ) : (
          <Card variant="surface" className="overflow-hidden border-sq-border" padding="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-sq-textPrimary">
                <thead className="bg-sq-surfaceSecondary border-b border-sq-border">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-sq-textSecondary uppercase tracking-wider text-xs">Name</th>
                    <th className="px-6 py-4 font-semibold text-sq-textSecondary uppercase tracking-wider text-xs">Email</th>
                    <th className="px-6 py-4 font-semibold text-sq-textSecondary uppercase tracking-wider text-xs">Assigned Counter</th>
                    <th className="px-6 py-4 font-semibold text-sq-textSecondary uppercase tracking-wider text-xs">Status</th>
                    <th className="px-6 py-4 font-semibold text-sq-textSecondary uppercase tracking-wider text-xs text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sq-border">
                  {staff.map((member) => (
                    <tr key={member._id} className="hover:bg-sq-surfaceSecondary transition-colors">
                      <td className="px-6 py-4 font-medium">{member.name}</td>
                      <td className="px-6 py-4 text-sq-textSecondary">{member.email}</td>
                      <td className="px-6 py-4">
                        {member.assignedCounter ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-sq-primary">{member.assignedCounter.name}</span>
                            <span className="text-[10px] text-sq-muted uppercase">
                              {member.assignedCounter.organization} &gt; {member.assignedCounter.location}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-sq-muted italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-bold rounded-lg border ${
                          member.isActive !== false
                            ? 'bg-sq-successBg text-sq-success border-sq-success'
                            : 'bg-red-500/10 text-red-400 border-red-500/30'
                        }`}>
                          {member.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(member._id)}
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-sq-border hover:bg-sq-surfaceSecondary text-sq-textSecondary hover:text-sq-textPrimary transition-colors"
                        >
                          {member.isActive !== false ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sq-textPrimary/40 backdrop-blur-sm">
          <Card variant="surface" className="w-full max-w-lg bg-sq-surface border border-sq-border shadow-md rounded-2xl relative">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-sq-textPrimary">Add New Staff</h2>
              <button onClick={() => setShowModal(false)} className="text-sq-textSecondary hover:text-sq-danger">
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="Full Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              <Input type="email" label="Email Address" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
              <Input type="password" label="Temporary Password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required minLength={8} />
              
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-sq-textSecondary">Assign Organization</label>
                <select className="w-full bg-sq-surface text-sq-textPrimary text-sm rounded-xl border border-sq-border px-3 py-2.5 focus:border-sq-primary focus:ring-1 focus:ring-sq-primary"
                  value={formData.organizationId} onChange={handleOrgChange}>
                  <option value="">-- Unassigned --</option>
                  {organizations.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
                </select>
              </div>

              {locations.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-sq-textSecondary">Location</label>
                  <select className="w-full bg-sq-surface text-sq-textPrimary text-sm rounded-xl border border-sq-border px-3 py-2.5"
                    value={formData.locationId} onChange={handleLocChange}>
                    <option value="">-- Select --</option>
                    {locations.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                  </select>
                </div>
              )}

              {departments.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-sq-textSecondary">Department</label>
                  <select className="w-full bg-sq-surface text-sq-textPrimary text-sm rounded-xl border border-sq-border px-3 py-2.5"
                    value={formData.departmentId} onChange={handleDepChange}>
                    <option value="">-- Select --</option>
                    {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                  </select>
                </div>
              )}

              {counters.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-sq-textSecondary">Counter</label>
                  <select className="w-full bg-sq-surface text-sq-textPrimary text-sm rounded-xl border border-sq-border px-3 py-2.5"
                    value={formData.counterId} onChange={e => setFormData({...formData, counterId: e.target.value})}>
                    <option value="">-- Select --</option>
                    {counters.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary">Create Staff</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
      </div>
    </MainLayout>
  );
};

export default AdminStaffPage;
