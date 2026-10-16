import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { TrendingUp, Inbox } from 'lucide-react';

/**
 * Custom Dark SaaS Tooltip for Throughput AreaChart
 */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-sq-surfaceSecondary p-3 rounded-xl border border-sq-border shadow-2xl text-xs">
        <p className="font-bold text-sq-textPrimary mb-1">{label}</p>
        <p className="text-sq-primary font-extrabold">
          Completed Services: {payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

/**
 * Throughput Chart visualizing completed service volume over time
 */
const ThroughputChart = ({ data }) => {
  const throughputData = data?.throughput || [];
  const hasData = throughputData.length > 0 && throughputData.some((d) => d.completed > 0);

  return (
    <div className="bg-sq-surface p-5 rounded-2xl border border-sq-border shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-sq-textPrimary flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-sq-primary" />
            Daily Service Throughput
          </h3>
          <p className="text-[11px] text-sq-textSecondary mt-0.5">
            Completed queue ticket volume grouped by date
          </p>
        </div>
      </div>

      {!hasData ? (
        <div className="h-64 flex flex-col items-center justify-center text-center border border-dashed border-sq-border rounded-xl bg-sq-surfaceSecondary">
          <Inbox className="w-8 h-8 text-sq-muted mb-2" />
          <p className="text-xs font-semibold text-sq-textSecondary">No completed service throughput recorded</p>
          <p className="text-[10px] text-sq-muted mt-1">Select a broader date range or verify completed queue activity</p>
        </div>
      ) : (
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={throughputData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="throughputGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F16B99" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#F16B99" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#282936" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#6F6D78"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#282936' }}
              />
              <YAxis
                stroke="#6F6D78"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#282936' }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="completed"
                stroke="#F16B99"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#throughputGlow)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default ThroughputChart;
