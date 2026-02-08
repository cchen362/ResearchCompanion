import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface ActivityChartProps {
  activityTimeline: { date: string; count: number }[];
}

export function ActivityChart({ activityTimeline }: ActivityChartProps) {
  const hasActivity = activityTimeline.some(d => d.count > 0);

  if (!hasActivity) return null;

  // Format dates for display
  const formattedTimeline = activityTimeline.map(d => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }));

  return (
    <div className="bg-[var(--color-surface)] rounded-xl shadow-sm border border-[var(--color-border-muted)] p-5 h-full">
      <h3 className="font-semibold text-[var(--color-text-primary)] mb-4">Research Activity (Last 7 Days)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={formattedTimeline}>
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2054d9" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#2054d9" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={30}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(value: number) => [`${value} finding${value !== 1 ? 's' : ''}`, 'Findings']}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#2054d9"
            strokeWidth={2}
            fill="url(#areaGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
