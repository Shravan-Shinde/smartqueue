import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  ChevronRight,
  Search,
  RefreshCw,
  SlidersHorizontal,
  MapPin,
  Clock,
  Layers,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import SkeletonLoader from '../components/common/SkeletonLoader';
import EmptyState from '../components/common/EmptyState';
import orgService from '../services/orgService';

/**
 * SmartQueue Dedicated Service & Organization Discovery Route (/discover)
 */
const DiscoverServicesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedCity, setSelectedCity] = useState('');
  const [page, setPage] = useState(1);

  const [organizations, setOrganizations] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1, limit: 12 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const categories = [
    { label: 'All Services', value: 'ALL' },
    { label: 'Hospitals', value: 'HOSPITAL' },
    { label: 'Banks', value: 'BANK' },
    { label: 'Government', value: 'GOVERNMENT' },
    { label: 'Salons & Spa', value: 'SALON' },
    { label: 'Service Centers', value: 'SERVICE_CENTER' },
    { label: 'Colleges', value: 'COLLEGE' },
  ];

  const fetchOrganizations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: 12,
        search: searchTerm.trim() || undefined,
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        city: selectedCity.trim() || undefined,
      };

      const result = await orgService.getOrganizations(params);
      setOrganizations(result.data.organizations || []);
      setPagination(result.data.pagination || {});
    } catch (err) {
      setError(err.message || 'Unable to load organizations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [page, searchTerm, selectedCategory, selectedCity]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchOrganizations();
  };

  const handleCategorySelect = (catValue) => {
    setSelectedCategory(catValue);
    setPage(1);
  };

  return (
    <MainLayout roleTitle="Discover Services">
      <div className="space-y-8 max-w-6xl mx-auto pb-12">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-sq-textPrimary tracking-tight">
            Discover Organizations & Services
          </h1>
          <p className="text-xs text-sq-textSecondary">
            Browse partner hospitals, banks, government centers, salons, and educational institutions to view live queues and join queues remotely.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <Card variant="surface" className="space-y-4 bg-sq-bg border border-sq-warning shadow-xl">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-sq-warning" />
              <input
                type="text"
                placeholder="Search organizations by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-sq-surface text-xs text-sq-textPrimary placeholder-[#A89C8C] rounded-xl pl-10 pr-4 py-2.5 border border-sq-warning focus:outline-none focus:border-sq-primary"
              />
            </div>

            <div className="w-full sm:w-48">
              <input
                type="text"
                placeholder="Filter by city (e.g. Pune)..."
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full bg-sq-surface text-xs text-sq-textPrimary placeholder-[#A89C8C] rounded-xl px-4 py-2.5 border border-sq-warning focus:outline-none focus:border-sq-primary"
              />
            </div>

            <Button type="submit" variant="primary" size="md" icon={Search}>
              Search
            </Button>
          </form>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <SlidersHorizontal className="w-4 h-4 text-sq-warning shrink-0 mr-1" />
            {categories.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => handleCategorySelect(cat.value)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat.value
                    ? 'bg-sq-primary text-sq-textPrimary font-extrabold shadow-md shadow-sm'
                    : 'bg-sq-surfaceSecondary text-sq-textSecondary hover:text-sq-textPrimary border border-sq-warning'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </Card>

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-950/40 border border-red-500/20 rounded-2xl flex items-center justify-between">
            <span className="text-xs text-red-300">{error}</span>
            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={fetchOrganizations}>
              Retry
            </Button>
          </div>
        )}

        {/* Organizations Grid */}
        {isLoading ? (
          <SkeletonLoader variant="card" count={6} />
        ) : organizations.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No Organizations Found"
            description="No organizations match your current search parameters or category filter."
            actionLabel="Clear Filters"
            onAction={() => {
              setSearchTerm('');
              setSelectedCategory('ALL');
              setSelectedCity('');
              setPage(1);
            }}
          />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {organizations.map((org) => (
                <Card key={org._id} hoverEffect className="flex flex-col justify-between space-y-4 bg-sq-bg border border-sq-warning shadow-lg">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sq-primarySubtle text-sq-textSecondary flex items-center justify-center font-bold text-sm border border-sq-borderStrong shrink-0">
                          {org.logoUrl ? (
                            <img src={org.logoUrl} alt={org.name} className="w-full h-full object-cover rounded-xl" />
                          ) : (
                            <Building2 className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <h3 className="text-base font-extrabold text-sq-textPrimary leading-snug">
                            {org.name}
                          </h3>
                        </div>
                      </div>
                    </div>

                    <Badge variant="sage" size="sm">
                      {org.category}
                    </Badge>

                    <p className="text-xs text-sq-textSecondary line-clamp-2 leading-relaxed">
                      {org.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-sq-border flex items-center justify-between">
                    <span className="text-[10px] text-sq-muted flex items-center gap-1">
                      <Clock className="w-3 h-3 text-sq-textSecondary" /> Open for Queuing
                    </span>
                    <Link to={`/organizations/${org._id}`}>
                      <Button variant="primary" size="sm" icon={ChevronRight}>
                        View Services
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-sq-border">
                <span className="text-xs text-sq-muted">
                  Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    isDisabled={page <= 1 || isLoading}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    isDisabled={page >= pagination.totalPages || isLoading}
                    onClick={() => setPage((prev) => prev + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default DiscoverServicesPage;
