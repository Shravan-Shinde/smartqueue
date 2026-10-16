import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { Clock, Inbox } from 'lucide-react';

/**
 * Custom Dark SaaS Tooltip for Peak Hours BarChart
 */
const CustomPeakTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-sq-surfaceSecondary p-3 rounded-xl border border-sq-border shadow-2xl text-xs space-y-1">
        <p className="font-bold text-sq-textPrimary mb-1">Time Slot: {label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} className="font-semibold">
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

/**
 * Peak Hours Chart displaying hourly demand distribution (Arrivals vs Completions)
 */
const PeakHoursChart = ({ data }) => {
  const peakHoursData = data?.peakHours || [];
  const hasData = peakHoursData.some((d) => d.arrivals > 0 || d.completed > 0);

  return (
    <div className="bg-sq-surface p-5 rounded-2xl border border-sq-border shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-sq-textPrimary flex items-center gap-2">
            <Clock className="w-4 h-4 text-sq-info" />
            24-Hour Peak Demand Analysis
          </h3>
          <p className="text-[11px] text-sq-textSecondary mt-0.5">
            Hourly distribution comparing customer arrivals vs completed services
          </p>
        </div>
      </div>

      {!hasData ? (
        <div className="h-64 flex flex-col items-center justify-center text-center border border-dashed border-sq-border rounded-xl bg-sq-surfaceSecondary">
          <Inbox className="w-8 h-8 text-sq-muted mb-2" />
          <p className="text-xs font-semibold text-sq-textSecondary">No peak-hour activity recorded</p>
          <p className="text-[10px] text-sq-muted mt-1">Select a broader date range to analyze hourly traffic trends</p>
        </div>
      ) : (
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={peakHoursData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#282936" vertical={false} />
              <XAxis
                dataKey="hour"
                stroke="#6F6D78"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#282936' }}
                interval={2}
              />
              <YAxis
                stroke="#6F6D78"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#282936' }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomPeakTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                iconType="circle"
              />
              <Bar
                name="Customer Arrivals (joinedAt)"
                dataKey="arrivals"
                fill="#287D91"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                name="Completed Services (completedAt)"
                dataKey="completed"
                fill="#B27BDD"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default PeakHoursChart;
