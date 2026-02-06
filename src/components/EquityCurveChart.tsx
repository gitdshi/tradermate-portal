import { useMemo } from 'react'
import {
    CartesianGrid,
    Legend,
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

interface BenchmarkDataPoint {
  datetime: string
  close: number
}

interface StockPriceDataPoint {
  datetime: string
  close: number
}

interface EquityCurveChartProps {
  data: EquityDataPoint[]
  initialCapital: number
  benchmarkData?: BenchmarkDataPoint[]
  benchmarkSymbol?: string
  stockPriceData?: StockPriceDataPoint[]
  stockSymbol?: string
  annualReturn?: number
}

export default function EquityCurveChart({ 
  data, 
  initialCapital,
  benchmarkData,
  benchmarkSymbol = 'Benchmark',
  stockPriceData,
  stockSymbol = 'Stock',
  annualReturn
}: EquityCurveChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []
    
    // Create a map for benchmark data if available
    const benchmarkMap = new Map<string, number>()
    if (benchmarkData && benchmarkData.length > 0) {
      benchmarkData.forEach(point => {
        const dateKey = new Date(point.datetime).toISOString().split('T')[0]
        benchmarkMap.set(dateKey, point.close)
      })
    }
    
    // Create a map for stock price data if available
    const stockPriceMap = new Map<string, number>()
    if (stockPriceData && stockPriceData.length > 0) {
      stockPriceData.forEach(point => {
        const dateKey = new Date(point.datetime).toISOString().split('T')[0]
        stockPriceMap.set(dateKey, point.close)
      })
    }
    
    // Get first benchmark value for normalization
    const firstBenchmark = benchmarkData?.[0]?.close || initialCapital
    // Get first stock price for normalization
    const firstStockPrice = stockPriceData?.[0]?.close || initialCapital
    
    return data.map((point, index) => {
      const dt = new Date(point.datetime)
      const dateKey = dt.toISOString().split('T')[0]
      const benchmarkValue = benchmarkMap.get(dateKey)
      const stockPrice = stockPriceMap.get(dateKey)
      
      // Calculate annual return trend line (linear projection)
      let annualTrend = undefined
      if (annualReturn && data.length > 0) {
        const dailyReturn = Math.pow(1 + annualReturn / 100, 1 / 252) - 1
        annualTrend = initialCapital * Math.pow(1 + dailyReturn, index)
      }
      
      return {
        date: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: point.datetime,
        balance: point.balance,
        pnl: point.net_pnl || 0,
        returnPct: ((point.balance - initialCapital) / initialCapital) * 100,
        benchmark: benchmarkValue ? (benchmarkValue / firstBenchmark) * initialCapital : undefined,
        benchmarkReturn: benchmarkValue ? ((benchmarkValue - firstBenchmark) / firstBenchmark) * 100 : undefined,
        benchmarkPrice: benchmarkValue,
        stockPrice: stockPrice,
        stockPriceNormalized: stockPrice ? (stockPrice / firstStockPrice) * initialCapital : undefined,
        annualTrend: annualTrend,
      }
    })
  }, [data, initialCapital, benchmarkData, annualReturn])

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-muted/30 rounded-lg">
        <p className="text-muted-foreground">No equity curve data available</p>
      </div>
    )
  }

  const minBalance = Math.min(
    ...chartData.map(d => d.balance),
    ...chartData.map(d => d.benchmark || Infinity).filter(v => v !== Infinity),
    ...chartData.map(d => d.stockPriceNormalized || Infinity).filter(v => v !== Infinity),
    ...chartData.map(d => d.annualTrend || Infinity).filter(v => v !== Infinity)
  )
  const maxBalance = Math.max(
    ...chartData.map(d => d.balance),
    ...chartData.map(d => d.benchmark || -Infinity).filter(v => v !== -Infinity),
    ...chartData.map(d => d.stockPriceNormalized || -Infinity).filter(v => v !== -Infinity),
    ...chartData.map(d => d.annualTrend || -Infinity).filter(v => v !== -Infinity)
  )
  const padding = (maxBalance - minBalance) * 0.1

  const hasBenchmark = chartData.some(d => d.benchmark !== undefined)
  const hasStockPrice = chartData.some(d => d.stockPriceNormalized !== undefined)
  const hasAnnualTrend = chartData.some(d => d.annualTrend !== undefined)

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
            formatter={(value: any, name: any) => {
              if (value === undefined) return ['N/A', name]
              if (name === 'balance') {
                return [`$${value.toLocaleString()}`, 'Strategy Equity']
              }
              if (name === 'benchmark') {
                return [`$${value.toLocaleString()}`, `Buy & Hold ${benchmarkSymbol}`]
              }
              if (name === 'stockPriceNormalized') {
                return [`$${value.toLocaleString()}`, `${stockSymbol} Price (Normalized)`]
              }
              if (name === 'benchmarkPrice') {
                return [`${value.toFixed(2)}`, `${benchmarkSymbol} Price`]
              }
              if (name === 'stockPrice') {
                return [`${value.toFixed(2)}`, `${stockSymbol} Price`]
              }
              if (name === 'annualTrend') {
                return [`$${value.toLocaleString()}`, 'Annual Trend']
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
          <Legend 
            wrapperStyle={{ paddingTop: '10px' }}
            iconType="line"
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
            name="Strategy Equity"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2 }}
          />
          {hasStockPrice && (
            <Line
              type="monotone"
              dataKey="stockPriceNormalized"
              name={`${stockSymbol} Price (Normalized)`}
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
          )}
          {hasBenchmark && (
            <Line
              type="monotone"
              dataKey="benchmark"
              name={`Buy & Hold ${benchmarkSymbol}`}
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
              connectNulls={true}
            />
          )}
          {hasAnnualTrend && (
            <Line
              type="monotone"
              dataKey="annualTrend"
              name="Annual Trend"
              stroke="#8b5cf6"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
