import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
export function TrendChart({
  data,
  unit = "L/100 km",
  bar = false,
  seriesName = "Recorded",
}: {
  data: { label: string; value: number }[];
  unit?: string;
  bar?: boolean;
  seriesName?: string;
}) {
  const common = { data, margin: { top: 15, right: 16, left: 0, bottom: 0 } };
  const parts = (
    <>
      <CartesianGrid
        strokeDasharray="3 6"
        vertical={false}
        stroke="var(--border)"
      />
      <XAxis
        dataKey="label"
        tick={{ fill: "var(--muted)", fontSize: 11 }}
        axisLine={false}
        tickLine={false}
        dy={10}
      />
      <YAxis
        tick={{ fill: "var(--muted)", fontSize: 11 }}
        tickFormatter={(value: number) =>
          Math.abs(value) >= 1_000_000
            ? `${(value / 1_000_000).toFixed(1)}M`
            : Math.abs(value) >= 10_000
              ? `${Math.round(value / 1_000)}k`
              : String(value)
        }
        axisLine={false}
        tickLine={false}
        width={40}
      />
      <Tooltip
        contentStyle={{
          background: "var(--elevated)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          color: "var(--text)",
          fontSize: 12,
        }}
        formatter={(value) => [
          `${Number(value).toFixed(2)} ${unit}`,
          seriesName,
        ]}
      />
    </>
  );
  return (
    <div
      className="chart"
      role="img"
      aria-label={`${unit} chart from your recorded data`}
    >
      <ResponsiveContainer width="100%" height="100%">
        {bar ? (
          <BarChart {...common}>
            {parts}
            <Bar
              dataKey="value"
              fill="#4e4e4e"
              radius={[5, 5, 0, 0]}
              maxBarSize={38}
            />
          </BarChart>
        ) : (
          <AreaChart {...common}>
            <defs>
              <linearGradient id="fuelGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#666666" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#666666" stopOpacity={0} />
              </linearGradient>
            </defs>
            {parts}
            <Area
              type="monotone"
              dataKey="value"
              stroke="#7d7d7d"
              strokeWidth={2.5}
              fill="url(#fuelGradient)"
              dot={{ r: 3, fill: "#7d7d7d" }}
              isAnimationActive={
                !matchMedia("(prefers-reduced-motion: reduce)").matches
              }
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
