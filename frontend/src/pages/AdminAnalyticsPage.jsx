import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import SkeletonLoader from '../components/common/SkeletonLoader';
import Button from '../components/common/Button';
import adminAnalyticsService from '../services/adminAnalyticsService';

import AnalyticsHeader from '../components/admin/analytics/AnalyticsHeader';
import AnalyticsFilters from '../components/admin/analytics/AnalyticsFilters';
import AnalyticsOverviewSection from '../components/admin/analytics/AnalyticsOverviewSection';
import ThroughputChart from '../components/admin/analytics/ThroughputChart';
import PeakHoursChart from '../components/admin/analytics/PeakHoursChart';
import QueuePerformanceTable from '../components/admin/analytics/QueuePerformanceTable';
import CounterPerformanceTable from '../components/admin/analytics/CounterPerformanceTable';
import CrowdStatusPanel from '../components/admin/analytics/CrowdStatusPanel';

/**
 * Main Admin Analytics Dashboard Page Component
 */
const AdminAnalyticsPage = () => {
  // Filter state
  const [filterParams, setFilterParams] = useState({});

  // Metric Data States
  const [overviewData, setOverviewData] = useState(null);
  const [queuesData, setQueuesData] = useState([]);
  const [countersData, setCountersData] = useState([]);
  const [trafficData, setTrafficData] = useState(null);
  const [crowdData, setCrowdData] = useState(null);

  // Status States
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch all analytics datasets concurrently
  const fetchAnalytics = useCallback(async (params = {}, isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage('');

    try {
      const [overviewRes, queuesRes, countersRes, trafficRes, crowdRes] = await Promise.allSettled([
        adminAnalyticsService.getAnalyticsOverview(params),
        adminAnalyticsService.getAnalyticsQueues(params),
        adminAnalyticsService.getAnalyticsCounters(params),
        adminAnalyticsService.getAnalyticsTraffic(params),
        adminAnalyticsService.getAnalyticsCrowd(params),
      ]);

      let hasError = false;
      let errText = '';

      if (overviewRes.status === 'fulfilled' && overviewRes.value?.success) {
        setOverviewData(overviewRes.value.data);
      } else {
        hasError = true;
        errText = overviewRes.reason?.response?.data?.message || overviewRes.reason?.message || 'Failed overview data';
      }

      if (queuesRes.status === 'fulfilled' && queuesRes.value?.success) {
        setQueuesData(queuesRes.value.data || []);
      }

      if (countersRes.status === 'fulfilled' && countersRes.value?.success) {
        setCountersData(countersRes.value.data || []);
      }

      if (trafficRes.status === 'fulfilled' && trafficRes.value?.success) {
        setTrafficData(trafficRes.value.data);
      }

      if (crowdRes.status === 'fulfilled' && crowdRes.value?.success) {
        setCrowdData(crowdRes.value.data);
      }

      if (hasError && !overviewRes.value) {
        setErrorMessage(`Analytics API Error: ${errText}`);
      } else {
        setLastUpdated(new Date());
      }
    } catch (err) {
      setErrorMessage(err.message || 'An error occurred while loading analytics.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial fetch on mount & whenever filterParams change
  useEffect(() => {
    fetchAnalytics(filterParams);
  }, [fetchAnalytics, filterParams]);

  // Apply new filters
  const handleApplyFilters = (newParams) => {
    setFilterParams(newParams);
  };

  // Manual Refresh
  const handleRefresh = () => {
    fetchAnalytics(filterParams, true);
  };

  return (
    <MainLayout roleTitle="Admin Operations Center">
      <div className="space-y-6">
        {/* Header */}
        <AnalyticsHeader
          lastUpdated={lastUpdated}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />

        {/* Filters */}
        <AnalyticsFilters
          onApplyFilters={handleApplyFilters}
          isLoading={isLoading || isRefreshing}
        />

        {/* Global Error Banner with Retry */}
        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-red-400">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-xs font-semibold">{errorMessage}</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              className="flex items-center gap-1.5 self-end sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </Button>
          </div>
        )}

        {/* Dashboard Content */}
        {isLoading ? (
          <div className="space-y-6">
            <SkeletonLoader variant="card" count={4} />
            <SkeletonLoader variant="table" count={3} />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Overview Section (KPI Cards & Live Banner) */}
            <AnalyticsOverviewSection data={overviewData} />

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ThroughputChart data={trafficData} />
              <PeakHoursChart data={trafficData} />
            </div>

            {/* Queue Performance Table */}
            <QueuePerformanceTable data={queuesData} />

            {/* Counter Performance Table */}
            <CounterPerformanceTable data={countersData} />

            {/* Crowd Status Panel */}
            <CrowdStatusPanel data={crowdData} />
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AdminAnalyticsPage;
