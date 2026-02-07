import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getSourceCategory } from '@/utils/sourceCategory';

interface ActivityChartProps {
  activityTimeline: { date: string; count: number }[];
  sourceBreakdown: { type: string; count: number }[];
}

// Match SourceIcon.tsx design system exactly (Tailwind-600 hex equivalents)
const SOURCE_COLORS: Record<string, string> = {
  pubmed: '#2563eb',         // blue-600
  clinical_trial: '#16a34a', // green-600
  fda: '#9333ea',            // purple-600
  web: '#4b5563',            // gray-600
};

const SOURCE_LABELS: Record<string, string> = {
  pubmed: 'PubMed',
  clinical_trial: 'Clinical Trial',
  fda: 'FDA',
  web: 'Web',
};

export function ActivityChart({ activityTimeline, sourceBreakdown }: ActivityChartProps) {
  const hasActivity = activityTimeline.some(d => d.count > 0);
  const hasSources = sourceBreakdown.length > 0;

  if (!hasActivity && !hasSources) return null;

  // Format dates for display
  const formattedTimeline = activityTimeline.map(d => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }));

  // Aggregate raw DB source types into canonical categories (matches SourceIcon.tsx)
  const categoryMap = new Map<string, number>();
  sourceBreakdown.forEach(s => {
    const category = getSourceCategory(s.type);
    categoryMap.set(category, (categoryMap.get(category) || 0) + s.count);
  });
  const sourcesWithColor = Array.from(categoryMap.entries()).map(([category, count]) => ({
    type: category,
    count,
    color: SOURCE_COLORS[category] || SOURCE_COLORS.web,
    label: SOURCE_LABELS[category] || category
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Activity Timeline */}
      {hasActivity && (
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
      )}

      {/* Source Breakdown */}
      {hasSources && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Research Sources</h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie
                  data={sourcesWithColor}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  dataKey="count"
                  paddingAngle={2}
                >
                  {sourcesWithColor.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(value: number, name: string) => [value, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {sourcesWithColor.map(source => (
                <div key={source.type} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: source.color }}
                  />
                  <span className="text-sm text-gray-700">{source.label}</span>
                  <span className="text-sm text-gray-400 ml-auto">{source.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
