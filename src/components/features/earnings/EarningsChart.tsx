'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTranslations } from 'next-intl';
import type { MonthlyEarning } from '@/server/queries/earnings.queries';

interface EarningsChartProps {
  data: MonthlyEarning[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  const t = useTranslations('earnings.chart');
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-lg border border-border bg-white p-3 shadow-lg">
      <p className="mb-2 font-bold text-foreground">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[#915564]">
            {entry.dataKey === 'revenueDisplay' ? t('gross') : t('netPayout')}:
          </span>
          <span className="font-bold text-foreground">
            CHF {(entry.value / 100).toLocaleString('de-CH', { minimumFractionDigits: 2 })}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Revenue Evolution chart for the earnings dashboard.
 * Area chart with gradient fill matching the mockup design.
 * Shows Gross revenue vs Net payout over the last 6 months.
 */
export function EarningsChart({ data }: EarningsChartProps) {
  const t = useTranslations('earnings.chart');

  // Format data for chart (convert cents to CHF for display)
  const chartData = data.map((d) => ({
    ...d,
    revenueDisplay: d.revenue / 100,
    payoutDisplay: d.payout / 100,
  }));

  // Calculate Y-axis domain
  const maxValue = Math.max(...data.map((d) => d.revenue / 100));
  const yAxisMax = Math.ceil(maxValue / 2500) * 2500 || 10000;

  return (
    <div className="rounded-xl border border-border bg-white p-6 lg:p-8 shadow-sm" role="region" aria-label="Revenue Evolution">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h2 id="earnings-chart-title" className="text-lg font-bold text-foreground">{t('title')}</h2>
          <p id="earnings-chart-desc" className="text-sm text-[#915564]">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-primary" />
            <span className="text-[#915564]">{t('gross')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-gray-300" />
            <span className="text-[#915564]">{t('netPayout')}</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[320px]" role="img" aria-labelledby="earnings-chart-title" aria-describedby="earnings-chart-desc">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#962a48" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#962a48" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorPayout" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9ca3af" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#9ca3af" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e5d2d7"
              vertical={false}
            />
            <XAxis
              dataKey="monthLabel"
              tick={{ fill: '#915564', fontSize: 12 }}
              axisLine={{ stroke: '#e5d2d7' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#915564', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              domain={[0, yAxisMax]}
              tickFormatter={(value) => {
                if (value === 0) return '0';
                if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
                return value.toString();
              }}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: '#e5d2d7', strokeWidth: 1 }}
            />
            {/* Net Payout Area (render first so Gross appears on top) */}
            <Area
              type="monotone"
              dataKey="payoutDisplay"
              name="Net Payout"
              stroke="#9ca3af"
              strokeWidth={2}
              fill="url(#colorPayout)"
              dot={false}
              activeDot={{
                r: 6,
                fill: '#9ca3af',
                stroke: '#fff',
                strokeWidth: 2,
              }}
            />
            {/* Gross Revenue Area */}
            <Area
              type="monotone"
              dataKey="revenueDisplay"
              name="Gross"
              stroke="#962a48"
              strokeWidth={3}
              fill="url(#colorRevenue)"
              dot={false}
              activeDot={{
                r: 6,
                fill: '#962a48',
                stroke: '#fff',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
