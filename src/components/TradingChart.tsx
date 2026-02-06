import { ArrowDown, ArrowUp } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
    Bar,
    CartesianGrid,
    ComposedChart,
    Legend,
    Line,
    ReferenceDot,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts'

interface StockPriceDataPoint {
  datetime: string
  open?: number
  high?: number
  low?: number
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

function LongEntryShape(props: any) {
  const { cx, cy } = props
  if (cx == null || cy == null) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />
      <polygon points={`${cx},${cy - 3} ${cx - 3},${cy + 2} ${cx + 3},${cy + 2}`} fill="#fff" />
    </g>
  )
}

function ShortEntryShape(props: any) {
  const { cx, cy } = props
  if (cx == null || cy == null) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#10b981" stroke="#fff" strokeWidth={1.5} />
      <polygon points={`${cx},${cy + 3} ${cx - 3},${cy - 2} ${cx + 3},${cy - 2}`} fill="#fff" />
    </g>
  )
}

function LongExitShape(props: any) {
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

function ShortExitShape(props: any) {
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

export default function TradingChart({
  stockPriceData,
  benchmarkData,
  trades,
  stockSymbol = 'Stock',
  benchmarkSymbol = 'Benchmark',
}: TradingChartProps) {
  const [zoomState, setZoomState] = useState({ startIndex: 0, endIndex: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState(0)
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const zoomStateRef = useRef(zoomState)
  const chartDataLengthRef = useRef(0)
  
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
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
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

  // Keep refs in sync for native event handlers
  zoomStateRef.current = zoomState
  chartDataLengthRef.current = chartData.length

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-muted/30 rounded-lg">
        <p className="text-muted-foreground">No price data available</p>
      </div>
    )
  }

  const hasBenchmark = chartData.some(d => d.benchmarkPrice !== undefined)

  // Get visible data based on zoom state
  const visibleData = chartData.slice(zoomState.startIndex, zoomState.endIndex + 1)

  // Calculate price domains from visible data (includes OHLC for candlesticks)
  const visibleStockPrices = visibleData.flatMap(d =>
    [d.open, d.high, d.low, d.close].filter((v): v is number => v != null)
  )
  const visibleTradePrices = tradeMarkers
    .filter(t => visibleData.some(d => d.date === t.date))
    .map(t => t.price)
  const allVisiblePrices = [...visibleStockPrices, ...visibleTradePrices]
  const stockMin = allVisiblePrices.length > 0 ? Math.min(...allVisiblePrices) : 0
  const stockMax = allVisiblePrices.length > 0 ? Math.max(...allVisiblePrices) : 100
  const stockPadding = (stockMax - stockMin) * 0.1 || 1

  const benchmarkPricesArr = visibleData.map(d => d.benchmarkPrice).filter((p): p is number => p !== undefined)
  const benchMin = benchmarkPricesArr.length > 0 ? Math.min(...benchmarkPricesArr) : 0
  const benchMax = benchmarkPricesArr.length > 0 ? Math.max(...benchmarkPricesArr) : 100
  const benchPadding = (benchMax - benchMin) * 0.1 || 1

  const handleResetZoom = () => {
    setZoomState({ startIndex: 0, endIndex: chartData.length - 1 })
  }

  // Initialize zoom to show all data
  if (zoomState.endIndex === 0 && chartData.length > 0) {
    setZoomState({ startIndex: 0, endIndex: chartData.length - 1 })
  }

  // Native wheel handler to prevent page scroll and zoom chart
  useEffect(() => {
    const el = chartContainerRef.current
    if (!el) return

    const handler = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const state = zoomStateRef.current
      const length = chartDataLengthRef.current
      if (length === 0) return

      const delta = e.deltaY > 0 ? 1 : -1
      const zoomFactor = 0.1
      const currentRange = state.endIndex - state.startIndex
      const zoomAmount = Math.max(1, Math.floor(currentRange * zoomFactor))

      if (delta > 0) {
        const newStart = Math.max(0, state.startIndex - zoomAmount)
        const newEnd = Math.min(length - 1, state.endIndex + zoomAmount)
        setZoomState({ startIndex: newStart, endIndex: newEnd })
      } else {
        const newStart = Math.min(state.startIndex + zoomAmount, state.endIndex - 10)
        const newEnd = Math.max(state.endIndex - zoomAmount, state.startIndex + 10)
        if (newEnd > newStart + 5) {
          setZoomState({ startIndex: newStart, endIndex: newEnd })
        }
      }
    }

    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // Handle mouse drag to pan
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart(e.clientX)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    const diff = dragStart - e.clientX
    const pixelsPerPoint = 800 / (zoomState.endIndex - zoomState.startIndex)
    const pointsToMove = Math.round(diff / pixelsPerPoint)

    if (Math.abs(pointsToMove) > 0) {
      const newStart = zoomState.startIndex + pointsToMove
      const newEnd = zoomState.endIndex + pointsToMove

      if (newStart >= 0 && newEnd < chartData.length) {
        setZoomState({ startIndex: newStart, endIndex: newEnd })
        setDragStart(e.clientX)
      }
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleMouseLeave = () => {
    setIsDragging(false)
  }

  return (
    <div className="w-full">
      {/* Legend for trade markers and zoom controls */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
              <ArrowUp className="w-2 h-2 text-white" />
            </div>
            <span>Long Entry</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
              <ArrowDown className="w-2 h-2 text-white" />
            </div>
            <span>Short Entry</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
              <span className="text-white text-[8px]">✕</span>
            </div>
            <span>Long Exit</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
              <span className="text-white text-[8px]">✕</span>
            </div>
            <span>Short Exit</span>
          </div>
        </div>
        <button
          onClick={handleResetZoom}
          className="px-3 py-1 text-xs border border-input rounded-md hover:bg-muted transition-colors"
        >
          Reset Zoom
        </button>
      </div>

      <div 
        ref={chartContainerRef}
        className={`h-80 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={visibleData}
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
                  const p = payload[0].payload
                  return p.fullDate?.split('T')[0] || _label
                }
                return _label
              }}
              content={(props: any) => {
                if (!props.active || !props.payload || !props.payload.length) return null
                const data = props.payload[0].payload
                return (
                  <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                    <div className="text-xs text-muted-foreground mb-1">{data.fullDate?.split('T')[0]}</div>
                    {data.open != null && (
                      <div className="text-xs space-y-0.5">
                        <div>Open: <span className="font-medium">{data.open.toFixed(2)}</span></div>
                        <div>High: <span className="font-medium">{data.high.toFixed(2)}</span></div>
                        <div>Low: <span className="font-medium">{data.low.toFixed(2)}</span></div>
                        <div>Close: <span className="font-medium">{data.close.toFixed(2)}</span></div>
                      </div>
                    )}
                    {data.benchmarkPrice != null && (
                      <div className="text-xs mt-1 pt-1 border-t border-border">
                        <div>{benchmarkSymbol}: <span className="font-medium">{data.benchmarkPrice.toFixed(2)}</span></div>
                      </div>
                    )}
                  </div>
                )
              }}
            />
            <Legend wrapperStyle={{ paddingTop: '10px' }} iconType="line" />
            {/* Candlestick chart for stock price (left axis) */}
            <Bar
              yAxisId="left"
              dataKey="close"
              name={stockSymbol}
              fill="transparent"
              stroke="transparent"
              isAnimationActive={false}
              shape={(props: any) => {
                const { x, y, width, height, payload } = props
                if (!payload || payload.open == null || payload.high == null ||
                    payload.low == null || payload.close == null || !height) return null

                const { open, high, low, close } = payload
                const domainBase = stockMin - stockPadding
                const range = close - domainBase
                if (range <= 0) return null

                const ppu = height / range
                const yForPrice = (price: number) => y + (close - price) * ppu

                const yOpen = yForPrice(open)
                const yClose = y
                const yHigh = yForPrice(high)
                const yLow = yForPrice(low)

                const isUp = close >= open
                const color = isUp ? '#ef4444' : '#10b981'
                const bodyY = Math.min(yOpen, yClose)
                const bodyHeight = Math.abs(yClose - yOpen) || 1
                const wickX = x + width / 2

                return (
                  <g>
                    <line x1={wickX} y1={yHigh} x2={wickX} y2={yLow} stroke={color} strokeWidth={1} />
                    <rect
                      x={x + width * 0.15}
                      y={bodyY}
                      width={width * 0.7}
                      height={bodyHeight}
                      fill={color}
                      stroke={color}
                      strokeWidth={0.5}
                    />
                  </g>
                )
              }}
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
            {tradeMarkers
              .filter(trade => {
                const dateIndex = chartData.findIndex(d => d.date === trade.date)
                return dateIndex >= zoomState.startIndex && dateIndex <= zoomState.endIndex
              })
              .map((trade, idx) => {
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
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
