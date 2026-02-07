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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Research Activity (Last 7 Days)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={formattedTimeline}>
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
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
            stroke="#4f46e5"
            strokeWidth={2}
            fill="url(#areaGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
