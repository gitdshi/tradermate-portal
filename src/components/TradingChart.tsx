import { ArrowDown, ArrowUp } from 'lucide-react'
import { useMemo } from 'react'
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ReferenceDot,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

interface StockPriceDataPoint {
  datetime: string
  close: number
}

interface BenchmarkDataPoint {
  datetime: string
  close: number
}

interface Trade {
  datetime?: string
  direction?: string
  offset?: string
  price?: number
  volume?: number
}

interface TradingChartProps {
  stockPriceData?: StockPriceDataPoint[]
  benchmarkData?: BenchmarkDataPoint[]
  trades?: Trade[]
  stockSymbol?: string
  benchmarkSymbol?: string
}

// Shape renderers for ReferenceDot — receives cx, cy as pixel coordinates
function LongEntryShape(props: any) {
  const { cx, cy } = props
  if (cx == null || cy == null) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#10b981" stroke="#fff" strokeWidth={1.5} />
      <polygon points={`${cx},${cy - 3} ${cx - 3},${cy + 2} ${cx + 3},${cy + 2}`} fill="#fff" />
    </g>
  )
}

function ShortEntryShape(props: any) {
  const { cx, cy } = props
  if (cx == null || cy == null) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />
      <polygon points={`${cx},${cy + 3} ${cx - 3},${cy - 2} ${cx + 3},${cy - 2}`} fill="#fff" />
    </g>
  )
}

function LongExitShape(props: any) {
  const { cx, cy } = props
  if (cx == null || cy == null) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#10b981" stroke="#fff" strokeWidth={1.5} />
      <line x1={cx - 2.5} y1={cy - 2.5} x2={cx + 2.5} y2={cy + 2.5} stroke="#fff" strokeWidth={1.5} />
      <line x1={cx - 2.5} y1={cy + 2.5} x2={cx + 2.5} y2={cy - 2.5} stroke="#fff" strokeWidth={1.5} />
    </g>
  )
}

function ShortExitShape(props: any) {
  const { cx, cy } = props
  if (cx == null || cy == null) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />
      <line x1={cx - 2.5} y1={cy - 2.5} x2={cx + 2.5} y2={cy + 2.5} stroke="#fff" strokeWidth={1.5} />
      <line x1={cx - 2.5} y1={cy + 2.5} x2={cx + 2.5} y2={cy - 2.5} stroke="#fff" strokeWidth={1.5} />
    </g>
  )
}

export default function TradingChart({
  stockPriceData,
  benchmarkData,
  trades,
  stockSymbol = 'Stock',
  benchmarkSymbol = 'Benchmark',
}: TradingChartProps) {
  
  const { chartData, tradeMarkers } = useMemo(() => {
    if (!stockPriceData || stockPriceData.length === 0) {
      return { chartData: [], tradeMarkers: [] }
    }

    // Create maps for quick lookup
    const stockMap = new Map<string, number>()
    stockPriceData.forEach(point => {
      const dateKey = new Date(point.datetime).toISOString().split('T')[0]
      stockMap.set(dateKey, point.close)
    })

    const benchmarkMap = new Map<string, number>()
    if (benchmarkData && benchmarkData.length > 0) {
      benchmarkData.forEach(point => {
        const dateKey = new Date(point.datetime).toISOString().split('T')[0]
        benchmarkMap.set(dateKey, point.close)
      })
    }

    // Build chart data with formatted date as key for X axis
    const data = stockPriceData.map(point => {
      const dt = new Date(point.datetime)
      const dateKey = dt.toISOString().split('T')[0]
      const benchmarkValue = benchmarkMap.get(dateKey)

      return {
        date: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: point.datetime,
        dateKey: dateKey,
        stockPrice: point.close,
        benchmarkPrice: benchmarkValue,
      }
    })

    // Process trades to create markers — match to chart date labels
    const markers: Array<{
      date: string      // formatted date label (must match X axis)
      price: number     // trade price (on stock Y axis)
      isLong: boolean
      isEntry: boolean
      direction: string
      offset: string
    }> = []

    if (trades && trades.length > 0) {
      // Build a dateKey -> formatted date label lookup
      const dateKeyToLabel = new Map<string, string>()
      data.forEach(d => dateKeyToLabel.set(d.dateKey, d.date))

      trades.forEach(trade => {
        if (trade.datetime && trade.price) {
          const dt = new Date(trade.datetime)
          const dateKey = dt.toISOString().split('T')[0]
          const dateLabel = dateKeyToLabel.get(dateKey)
          if (!dateLabel) return // skip if date not in chart range

          const dir = (trade.direction || '').toUpperCase()
          const ofs = (trade.offset || '').toUpperCase()
          const isLong = dir === '多' || dir === 'LONG'
          const isEntry = ofs === '开' || ofs === 'OPEN'

          markers.push({
            date: dateLabel,
            price: trade.price,
            isLong,
            isEntry,
            direction: trade.direction || '',
            offset: trade.offset || '',
          })
        }
      })
    }

    console.log('TradingChart - chartData points:', data.length, 'tradeMarkers:', markers.length)
    if (markers.length > 0) console.log('TradingChart - marker sample:', markers[0])

    return { chartData: data, tradeMarkers: markers }
  }, [stockPriceData, benchmarkData, trades])

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-muted/30 rounded-lg">
        <p className="text-muted-foreground">No price data available</p>
      </div>
    )
  }

  const hasBenchmark = chartData.some(d => d.benchmarkPrice !== undefined)

  // Calculate price domains for each axis
  const stockPrices = chartData.map(d => d.stockPrice).filter(p => p !== undefined)
  const tradePrices = tradeMarkers.map(t => t.price)
  const allStockPrices = [...stockPrices, ...tradePrices]
  const stockMin = Math.min(...allStockPrices)
  const stockMax = Math.max(...allStockPrices)
  const stockPadding = (stockMax - stockMin) * 0.1 || 1

  const benchmarkPricesArr = chartData.map(d => d.benchmarkPrice).filter((p): p is number => p !== undefined)
  const benchMin = benchmarkPricesArr.length > 0 ? Math.min(...benchmarkPricesArr) : 0
  const benchMax = benchmarkPricesArr.length > 0 ? Math.max(...benchmarkPricesArr) : 100
  const benchPadding = (benchMax - benchMin) * 0.1 || 1

  return (
    <div className="w-full">
      {/* Legend for trade markers */}
      <div className="flex items-center gap-4 mb-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
            <ArrowUp className="w-2 h-2 text-white" />
          </div>
          <span>Long Entry</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
            <ArrowDown className="w-2 h-2 text-white" />
          </div>
          <span>Short Entry</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
            <span className="text-white text-[8px]">✕</span>
          </div>
          <span>Long Exit</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
            <span className="text-white text-[8px]">✕</span>
          </div>
          <span>Short Exit</span>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 60, left: 10, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            {/* Left Y-axis: Stock Price */}
            <YAxis
              yAxisId="left"
              orientation="left"
              domain={[stockMin - stockPadding, stockMax + stockPadding]}
              tick={{ fontSize: 11, fill: '#10b981' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => value.toFixed(2)}
            />
            {/* Right Y-axis: Benchmark Price */}
            {hasBenchmark && (
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[benchMin - benchPadding, benchMax + benchPadding]}
                tick={{ fontSize: 11, fill: '#f59e0b' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => value.toFixed(0)}
              />
            )}
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: any, name: any) => {
                if (value === undefined || value === null) return ['N/A', name]
                if (name === stockSymbol) {
                  return [Number(value).toFixed(2), stockSymbol]
                }
                if (name === benchmarkSymbol) {
                  return [Number(value).toFixed(2), benchmarkSymbol]
                }
                return [value, name]
              }}
              labelFormatter={(_label, payload) => {
                if (payload && payload[0]) {
                  return payload[0].payload.fullDate?.split('T')[0] || _label
                }
                return _label
              }}
            />
            <Legend wrapperStyle={{ paddingTop: '10px' }} iconType="line" />
            {/* Stock price line (left axis) */}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="stockPrice"
              name={stockSymbol}
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
            {/* Benchmark price line (right axis) */}
            {hasBenchmark && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="benchmarkPrice"
                name={benchmarkSymbol}
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2 }}
              />
            )}
            {/* Trade markers on stock price axis */}
            {tradeMarkers.map((trade, idx) => {
              const ShapeComponent = trade.isEntry
                ? (trade.isLong ? LongEntryShape : ShortEntryShape)
                : (trade.isLong ? LongExitShape : ShortExitShape)

              return (
                <ReferenceDot
                  key={`trade-${idx}`}
                  yAxisId="left"
                  x={trade.date}
                  y={trade.price}
                  r={6}
                  fill="transparent"
                  stroke="transparent"
                  shape={<ShapeComponent />}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
