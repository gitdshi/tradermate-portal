import { useMemo } from 'react'
import {
    CartesianGrid,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

interface EquityDataPoint {
  datetime: string
  balance: number
  net_pnl?: number
}

interface EquityCurveChartProps {
  data: EquityDataPoint[]
  initialCapital: number
}

export default function EquityCurveChart({ data, initialCapital }: EquityCurveChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []
    
    return data.map((point) => {
      const dt = new Date(point.datetime)
      return {
        date: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: point.datetime,
        balance: point.balance,
        pnl: point.net_pnl || 0,
        returnPct: ((point.balance - initialCapital) / initialCapital) * 100,
      }
    })
  }, [data, initialCapital])

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-muted/30 rounded-lg">
        <p className="text-muted-foreground">No equity curve data available</p>
      </div>
    )
  }

  const minBalance = Math.min(...chartData.map(d => d.balance))
  const maxBalance = Math.max(...chartData.map(d => d.balance))
  const padding = (maxBalance - minBalance) * 0.1

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minBalance - padding, maxBalance + padding]}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(value: number, name: string) => {
              if (name === 'balance') {
                return [`$${value.toLocaleString()}`, 'Balance']
              }
              return [value, name]
            }}
            labelFormatter={(label, payload) => {
              if (payload && payload[0]) {
                return payload[0].payload.fullDate
              }
              return label
            }}
          />
          <ReferenceLine
            y={initialCapital}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="5 5"
            label={{
              value: 'Initial',
              position: 'right',
              fill: 'hsl(var(--muted-foreground))',
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="balance"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
