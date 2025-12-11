"use client"

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceDot,
} from "recharts"

export interface ChartData {
  type: "line" | "bar" | "pie" | "area"
  title?: string
  data: Array<Record<string, any>>
  xKey?: string
  yKey?: string | string[]
  colors?: string[]
}

const DEFAULT_COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#0088FE",
]

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

export function ChartRenderer({ chart }: { chart: ChartData }) {
  const { type, title, data, xKey = "name", yKey = "value", colors = DEFAULT_COLORS } = chart
  
  const yKeys = Array.isArray(yKey) ? yKey : [yKey]

  if (!data || data.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No data available for chart
      </div>
    )
  }

  // Check if this is a monthly chart and pad data to 12 months for consistent display
  const isMonthlyChart = xKey === "month" && data.some(d => MONTHS.includes(d.month))
  
  // Track which months are missing data (for showing dots at y=0)
  const monthsWithData = new Set(data.map(d => d[xKey]))
  const missingMonths = isMonthlyChart 
    ? MONTHS.filter(month => !monthsWithData.has(month))
    : []
  
  const normalizedData = isMonthlyChart
    ? MONTHS.map(month => {
        const existing = data.find(d => d[xKey] === month)
        if (existing) return existing
        // Return placeholder with null so line doesn't connect
        const placeholder: Record<string, any> = { [xKey]: month }
        yKeys.forEach(key => { placeholder[key] = null })
        return placeholder
      })
    : data

  return (
    <div className="my-4 p-4 bg-background/50 rounded-lg border">
      {title && (
        <h3 className="text-sm font-medium mb-4 text-center">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={300}>
        {type === "line" ? (
          <LineChart data={normalizedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey={xKey} 
              tick={{ fontSize: 12 }} 
              stroke="#888"
              interval={0}
              angle={isMonthlyChart ? -45 : 0}
              textAnchor={isMonthlyChart ? "end" : "middle"}
              height={isMonthlyChart ? 60 : 30}
              tickFormatter={isMonthlyChart ? (value) => value.slice(0, 3) : undefined}
            />
            <YAxis 
              tick={{ fontSize: 12 }} 
              stroke="#888"
              tickFormatter={(value) => 
                typeof value === 'number' && value >= 1000 
                  ? `$${(value / 1000).toFixed(0)}k` 
                  : value
              }
            />
            <Tooltip 
              formatter={(value: number) => 
                typeof value === 'number' 
                  ? `$${value.toLocaleString()}` 
                  : value
              }
            />
            <Legend />
            {yKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls={false}
              />
            ))}
            {/* Show dots at y=0 for missing months (no data) */}
            {missingMonths.map((month) => 
              yKeys.map((key, index) => (
                <ReferenceDot
                  key={`${month}-${key}`}
                  x={month}
                  y={0}
                  r={4}
                  fill={colors[index % colors.length]}
                  fillOpacity={0.4}
                  stroke={colors[index % colors.length]}
                  strokeOpacity={0.6}
                />
              ))
            )}
          </LineChart>
        ) : type === "bar" ? (
          <BarChart data={normalizedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey={xKey} 
              tick={{ fontSize: 12 }} 
              stroke="#888"
              interval={0}
              angle={isMonthlyChart ? -45 : 0}
              textAnchor={isMonthlyChart ? "end" : "middle"}
              height={isMonthlyChart ? 60 : 30}
              tickFormatter={isMonthlyChart ? (value) => value.slice(0, 3) : undefined}
            />
            <YAxis 
              tick={{ fontSize: 12 }} 
              stroke="#888"
              tickFormatter={(value) => 
                typeof value === 'number' && value >= 1000 
                  ? `$${(value / 1000).toFixed(0)}k` 
                  : value
              }
            />
            <Tooltip 
              formatter={(value: number) => 
                typeof value === 'number' 
                  ? `$${value.toLocaleString()}` 
                  : value
              }
            />
            <Legend />
            {yKeys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={colors[index % colors.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        ) : type === "area" ? (
          <AreaChart data={normalizedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey={xKey} 
              tick={{ fontSize: 12 }} 
              stroke="#888"
              interval={0}
              angle={isMonthlyChart ? -45 : 0}
              textAnchor={isMonthlyChart ? "end" : "middle"}
              height={isMonthlyChart ? 60 : 30}
              tickFormatter={isMonthlyChart ? (value) => value.slice(0, 3) : undefined}
            />
            <YAxis 
              tick={{ fontSize: 12 }} 
              stroke="#888"
              tickFormatter={(value) => 
                typeof value === 'number' && value >= 1000 
                  ? `$${(value / 1000).toFixed(0)}k` 
                  : value
              }
            />
            <Tooltip 
              formatter={(value: number) => 
                typeof value === 'number' 
                  ? `$${value.toLocaleString()}` 
                  : value
              }
            />
            <Legend />
            {yKeys.map((key, index) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                fill={colors[index % colors.length]}
                fillOpacity={0.3}
                connectNulls={false}
              />
            ))}
            {/* Show dots at y=0 for missing months (no data) */}
            {missingMonths.map((month) => 
              yKeys.map((key, index) => (
                <ReferenceDot
                  key={`${month}-${key}`}
                  x={month}
                  y={0}
                  r={4}
                  fill={colors[index % colors.length]}
                  fillOpacity={0.4}
                  stroke={colors[index % colors.length]}
                  strokeOpacity={0.6}
                />
              ))
            )}
          </AreaChart>
        ) : type === "pie" ? (
          <PieChart>
            <Pie
              data={data}
              dataKey={yKeys[0]}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: number) => 
                typeof value === 'number' 
                  ? `$${value.toLocaleString()}` 
                  : value
              }
            />
            <Legend />
          </PieChart>
        ) : null}
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Parse chart data from AI response
 * Looks for ```chart JSON blocks
 */
export function parseChartFromMessage(content: string): { text: string; charts: ChartData[] } {
  const chartRegex = /```chart\n([\s\S]*?)\n```/g
  const charts: ChartData[] = []
  
  let text = content
  let match
  
  while ((match = chartRegex.exec(content)) !== null) {
    try {
      const chartData = JSON.parse(match[1])
      if (chartData.type && chartData.data) {
        charts.push(chartData)
      }
    } catch (e) {
      console.error("Failed to parse chart data:", e)
    }
    text = text.replace(match[0], "")
  }
  
  return { text: text.trim(), charts }
}

