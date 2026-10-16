import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  MapPin,
  Phone,
  Clock,
  Briefcase,
  ChevronLeft,
  RefreshCw,
  Layers,
  Ticket,
  Users,
  Play,
  Pause,
  XCircle,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Toast from '../components/common/Toast';
import SkeletonLoader from '../components/common/SkeletonLoader';
import EmptyState from '../components/common/EmptyState';
import orgService from '../services/orgService';
import queueService from '../services/queueService';

/**
 * SmartQueue Organization & Service Details Discovery Page
 */
const OrganizationDetailsPage = () => {
  const { organizationId } = useParams();
  const navigate = useNavigate();

  // Async Data States
  const [organization, setOrganization] = useState(null);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [deptQueues, setDeptQueues] = useState({}); // { [deptId]: [queues] }

  // Loading & Toast States
  const [isOrgLoading, setIsOrgLoading] = useState(true);
  const [isLocLoading, setIsLocLoading] = useState(false);
  const [isDeptLoading, setIsDeptLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Queue Join Modal States
  const [joiningQueue, setJoiningQueue] = useState(null);
  const [isJoining, setIsJoining] = useState(false);

  // Fetch Organization details & Locations list on load
  useEffect(() => {
    const fetchOrgData = async () => {
      setIsOrgLoading(true);
      setIsLocLoading(true);
      setError(null);
      try {
        const orgRes = await orgService.getOrganizationById(organizationId);
        setOrganization(orgRes.data.organization);

        const locRes = await orgService.getLocations(organizationId);
        const locList = locRes.data.locations;
        setLocations(locList);

        // Auto-select first location if available
        if (locList.length > 0) {
          setSelectedLocation(locList[0]);
        }
      } catch (err) {
        setError(err.message || 'Failed to load organization information.');
      } finally {
        setIsOrgLoading(false);
        setIsLocLoading(false);
      }
    };

    fetchOrgData();
  }, [organizationId]);

  // Fetch Departments & Queues when selected location changes
  useEffect(() => {
    if (!selectedLocation || !organizationId) return;

    const fetchDeptData = async () => {
      setIsDeptLoading(true);
      try {
        const deptRes = await orgService.getDepartments(
          organizationId,
          selectedLocation._id
        );
        const deptList = deptRes.data.departments;
        setDepartments(deptList);

        // Fetch active queues for each department
        const queuesMap = {};
        await Promise.all(
          deptList.map(async (d) => {
            try {
              const qRes = await queueService.getQueuesForDepartment(d._id);
              queuesMap[d._id] = qRes.data || [];
            } catch (e) {
              queuesMap[d._id] = [];
            }
          })
        );
        setDeptQueues(queuesMap);
      } catch (err) {
        setDepartments([]);
        setDeptQueues({});
      } finally {
        setIsDeptLoading(false);
      }
    };

    fetchDeptData();
  }, [organizationId, selectedLocation]);

  // Submit Join Queue
  const handleConfirmJoinQueue = async () => {
    if (!joiningQueue) return;
    setIsJoining(true);
    try {
      const res = await queueService.joinQueue(joiningQueue._id);
      setToastMessage({
        type: 'success',
        text: `Joined queue successfully! Ticket: ${res.data?.entry?.ticketNumber || 'Generated'}`,
      });
      setJoiningQueue(null);
      // Navigate to customer live tracker page
      setTimeout(() => {
        navigate(`/queue/${res.data?.entry?.id || res.data?.entry?._id || 'tracker'}`);
      }, 500);
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'Failed to join queue.' });
    } finally {
      setIsJoining(false);
    }
  };

  if (isOrgLoading) {
    return (
      <MainLayout roleTitle="Organization Services">
        <div className="max-w-4xl mx-auto space-y-6">
          <SkeletonLoader variant="card" count={1} />
          <SkeletonLoader variant="table" count={3} />
        </div>
      </MainLayout>
    );
  }

  if (error || !organization) {
    return (
      <MainLayout roleTitle="Organization Services">
        <div className="max-w-3xl mx-auto py-12 text-center space-y-4">
          <EmptyState
            icon={Building2}
            title="Organization Not Found"
            description={error || 'The requested organization is not available or inactive.'}
          />
          <Link to="/dashboard">
            <Button variant="secondary" icon={ChevronLeft}>
              Back to Organization Discovery
            </Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout roleTitle="Service Discovery">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            to="/dashboard"
            className="text-xs text-sq-info hover:underline inline-flex items-center gap-1 font-semibold"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Organizations
          </Link>
        </div>

        {/* Organization Header Banner Card */}
        <Card variant="surface" className="space-y-4 relative overflow-hidden border-l-4 border-l-[#F16B99]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-sq-surfaceSecondary text-sq-primary flex items-center justify-center font-black text-xl border border-sq-border shrink-0">
                {organization.logo ? (
                  <img
                    src={organization.logo}
                    alt={organization.name}
                    className="w-full h-full object-cover rounded-2xl"
                  />
                ) : (
                  <Building2 className="w-8 h-8" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-extrabold text-sq-textPrimary">
                    {organization.name}
                  </h1>
                  <Badge variant="pink" size="sm">
                    {organization.category}
                  </Badge>
                </div>
                <p className="text-xs text-sq-textSecondary leading-relaxed max-w-2xl">
                  {organization.description}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Location Selection & Department Services Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Locations List */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-sq-textPrimary flex items-center gap-2">
              <MapPin className="w-5 h-5 text-sq-info" />
              Locations ({locations.length})
            </h2>

            {isLocLoading ? (
              <SkeletonLoader variant="table" count={3} />
            ) : locations.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title="No Locations"
                description="No active locations listed for this organization."
              />
            ) : (
              <div className="space-y-3">
                {locations.map((loc) => {
                  const isSelected = selectedLocation?._id === loc._id;
                  return (
                    <div
                      key={loc._id}
                      onClick={() => setSelectedLocation(loc)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-sq-surfaceSecondary border-sq-warning shadow-lg shadow-sq-warning/10'
                          : 'bg-sq-surface border-sq-border hover:border-sq-border'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <h3 className="text-sm font-bold text-sq-textPrimary">{loc.name}</h3>
                        {isSelected && (
                          <Badge variant="pink" size="sm">
                            Selected
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-sq-textSecondary mt-1">{loc.address}, {loc.city}</p>
                      {loc.phone && (
                        <p className="text-[11px] text-sq-muted flex items-center gap-1 mt-2">
                          <Phone className="w-3 h-3 text-sq-info" /> {loc.phone}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Departments/Services for Selected Location */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-sq-textPrimary flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-sq-info" />
                Available Departments / Services
              </h2>
              {selectedLocation && (
                <span className="text-xs text-sq-textSecondary">
                  At {selectedLocation.name} ({selectedLocation.city})
                </span>
              )}
            </div>

            {/* Toast Notifications */}
            {toastMessage && (
              <Toast
                type={toastMessage.type}
                message={toastMessage.text}
                onClose={() => setToastMessage(null)}
              />
            )}

            {isDeptLoading ? (
              <SkeletonLoader variant="card" count={2} />
            ) : !selectedLocation ? (
              <EmptyState
                icon={MapPin}
                title="Select a Location"
                description="Please select a location from the left menu to discover available service departments."
              />
            ) : departments.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title="No Services Available"
                description="There are currently no active departments or services listed at this location."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {departments.map((dept) => {
                  const queues = deptQueues[dept._id] || [];
                  return (
                    <Card key={dept._id} variant="secondary" className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-base font-bold text-sq-textPrimary">{dept.name}</h4>
                          <span className="text-[10px] text-sq-info font-mono">
                            Prefix: {dept.prefix || 'A'}
                          </span>
                        </div>
                        <Badge variant="purple" size="sm">
                          {queues.length} {queues.length === 1 ? 'Queue' : 'Queues'}
                        </Badge>
                      </div>

                      {dept.description && (
                        <p className="text-xs text-sq-textSecondary leading-relaxed">
                          {dept.description}
                        </p>
                      )}

                      {/* Department Queues List */}
                      <div className="pt-2 border-t border-sq-border space-y-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-sq-muted">
                          Available Service Queues
                        </span>

                        {queues.length === 0 ? (
                          <p className="text-xs text-sq-muted italic py-1">
                            No active queues configured for this department yet.
                          </p>
                        ) : (
                          queues.map((q) => {
                            const isOpen = q.status === 'OPEN';
                            return (
                              <div
                                key={q._id}
                                className="p-3 bg-sq-surfaceSecondary rounded-xl border border-sq-border space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded bg-sq-infoBg text-sq-info font-mono text-xs font-bold border border-sq-info">
                                      {q.prefix}
                                    </span>
                                    <h5 className="text-xs font-bold text-sq-textPrimary">{q.name}</h5>
                                  </div>
                                  <Badge
                                    variant={q.status === 'OPEN' ? 'success' : q.status === 'PAUSED' ? 'warning' : 'danger'}
                                    size="sm"
                                    dot
                                  >
                                    {q.status}
                                  </Badge>
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-sq-textSecondary">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-sq-info" />
                                    {q.avgServiceTimeMins || 15} mins avg
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3 text-sq-primary" />
                                    Cap: {q.maxCapacity || 100}
                                  </span>
                                </div>

                                <div className="pt-1.5 flex justify-end">
                                  {isOpen ? (
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      icon={Ticket}
                                      onClick={() => setJoiningQueue(q)}
                                    >
                                      Join Queue
                                    </Button>
                                  ) : (
                                    <span className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-sq-surfaceSecondary text-sq-muted border border-sq-border cursor-not-allowed">
                                      {q.status === 'PAUSED' ? 'Paused' : 'Closed'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CONFIRM JOIN QUEUE MODAL */}
      <Modal
        isOpen={!!joiningQueue}
        onClose={() => setJoiningQueue(null)}
        title={`Join ${joiningQueue?.name}?`}
        subtitle={`${organization?.name} — ${selectedLocation?.name}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-sq-textSecondary leading-relaxed">
            By joining this queue, you will be assigned a digital ticket token and placed in the queue in FIFO order.
          </p>

          <div className="p-3.5 bg-sq-surfaceSecondary rounded-xl border border-sq-border space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-sq-muted">Queue Prefix:</span>
              <span className="font-mono text-sq-info font-bold">{joiningQueue?.prefix}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sq-muted">Average Service Time:</span>
              <span className="text-sq-info font-semibold">{joiningQueue?.avgServiceTimeMins} mins</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sq-muted">Queue Status:</span>
              <span className="text-emerald-400 font-bold">{joiningQueue?.status}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-sq-border">
            <Button variant="secondary" size="sm" onClick={() => setJoiningQueue(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Ticket}
              isLoading={isJoining}
              onClick={handleConfirmJoinQueue}
            >
              Confirm Join
            </Button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  );
};

export default OrganizationDetailsPage;
