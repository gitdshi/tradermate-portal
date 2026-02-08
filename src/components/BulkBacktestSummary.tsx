import { useQuery } from '@tanstack/react-query'
import { BarChart3, Loader, TrendingDown, Trophy, X, XCircle } from 'lucide-react'
import { useEffect } from 'react'
import { queueAPI } from '../lib/api'
import type { BulkSummarySymbol, BulkBacktestSummary as BulkSummaryType } from '../types'

interface BulkBacktestSummaryProps {
  jobId: string
  onClose: () => void
  onViewChildResult?: (jobId: string) => void
}

export default function BulkBacktestSummary({ jobId, onClose, onViewChildResult }: BulkBacktestSummaryProps) {
  const { data, isLoading, error } = useQuery<BulkSummaryType>({
    queryKey: ['bulk-summary', jobId],
    queryFn: async () => {
      const res = await queueAPI.getBulkJobSummary(jobId)
      return res.data
    },
  })

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-background border border-border rounded-lg shadow-2xl mt-[5vh] mx-4">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Bulk Backtest Summary
            </h2>
            <p className="text-xs text-muted-foreground font-mono">{jobId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-md transition-colors"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error || !data ? (
          <div className="text-center py-12 text-destructive">
            Failed to load summary. <button onClick={onClose} className="text-primary underline ml-2">Close</button>
          </div>
        ) : (
          <SummaryContent data={data} jobId={jobId} onViewChildResult={onViewChildResult} />
        )}
      </div>
    </div>
  )
}

function SummaryContent({ data, jobId, onViewChildResult }: { data: BulkSummaryType; jobId: string; onViewChildResult?: (jobId: string) => void }) {
  const fmt = (v: number | null | undefined, suffix = '%') =>
    v !== null && v !== undefined ? `${v.toFixed(2)}${suffix}` : '-'

  return (
    <div className="p-6 space-y-6">

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="Total" value={data.total_symbols} />
        <StatCard label="Completed" value={data.completed_count} color="text-blue-500" />
        <StatCard label="Failed" value={data.failed_count} color="text-red-500" />
        <StatCard label="Winning" value={data.winning_count} color="text-red-500" />
        <StatCard label="Losing" value={data.losing_count} color="text-green-500" />
        <StatCard label="Win Rate" value={`${data.win_rate.toFixed(1)}%`} color={data.win_rate >= 50 ? 'text-red-500' : 'text-green-500'} />
        <StatCard
          label="Avg Return"
          value={fmt(data.avg_metrics.total_return)}
          color={data.avg_metrics.total_return !== null && data.avg_metrics.total_return >= 0 ? 'text-red-500' : 'text-green-500'}
        />
      </div>

      {/* Average Metrics */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Average Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <MetricItem label="Total Return" value={fmt(data.avg_metrics.total_return)} positive={data.avg_metrics.total_return !== null && data.avg_metrics.total_return >= 0} />
          <MetricItem label="Annual Return" value={fmt(data.avg_metrics.annual_return)} positive={data.avg_metrics.annual_return !== null && data.avg_metrics.annual_return >= 0} />
          <MetricItem label="Sharpe Ratio" value={fmt(data.avg_metrics.sharpe_ratio, '')} positive={data.avg_metrics.sharpe_ratio !== null && data.avg_metrics.sharpe_ratio >= 0} />
          <MetricItem label="Max Drawdown" value={fmt(data.avg_metrics.max_drawdown)} positive={false} />
          <MetricItem label="Win Rate" value={fmt(data.avg_metrics.winning_rate)} positive={data.avg_metrics.winning_rate !== null && data.avg_metrics.winning_rate >= 50} />
          <MetricItem label="Profit Factor" value={fmt(data.avg_metrics.profit_factor, '')} positive={data.avg_metrics.profit_factor !== null && data.avg_metrics.profit_factor >= 1} />
          <MetricItem label="Avg Trades" value={fmt(data.avg_metrics.total_trades, '')} />
        </div>
      </div>

      {/* Return Distribution */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Return Distribution</h3>
        <div className="flex items-end gap-2 h-32">
          {Object.entries(data.return_distribution).map(([bucket, count]) => {
            const maxCount = Math.max(...Object.values(data.return_distribution), 1)
            const height = (count / maxCount) * 100
            const isNeg = bucket.includes('-') || bucket.startsWith('<')
            const isPos = bucket.includes('>') || (!bucket.includes('-') && bucket.startsWith('0') || bucket.startsWith('10') || bucket.startsWith('>'))
            return (
              <div key={bucket} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-semibold">{count}</span>
                <div
                  className={`w-full rounded-t transition-all ${
                    isNeg ? 'bg-green-500/60' : isPos ? 'bg-red-500/60' : 'bg-muted-foreground/30'
                  }`}
                  style={{ height: `${Math.max(height, 4)}%` }}
                />
                <span className="text-[9px] text-muted-foreground text-center leading-tight">{bucket}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top 10 */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-red-500/5">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-red-500" />
            Top 10 Performers
          </h3>
        </div>
        <SymbolTable symbols={data.top10} onViewResult={onViewChildResult} parentJobId={jobId} />
      </div>

      {/* Bottom 10 */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-green-500/5">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-green-500" />
            Bottom 10 Performers
          </h3>
        </div>
        <SymbolTable symbols={data.bottom10} onViewResult={onViewChildResult} parentJobId={jobId} />
      </div>

      {/* Failed symbols */}
      {data.failed_symbols.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-destructive/5">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              Failed Symbols ({data.failed_symbols.length})
            </h3>
          </div>
          <div className="divide-y divide-border">
            {data.failed_symbols.map((f) => (
              <div key={f.symbol} className="px-4 py-2 text-xs flex items-center justify-between">
                <span className="font-medium">{f.symbol}</span>
                <span className="text-destructive truncate max-w-[60%]">{f.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---- Helper components ---- */

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-center">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-xl font-bold ${color || ''}`}>{value}</div>
    </div>
  )
}

function MetricItem({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={`text-base font-bold ${positive === true ? 'text-red-500' : positive === false ? 'text-green-500' : ''}`}>
        {value}
      </div>
    </div>
  )
}

function SymbolTable({
  symbols,
  onViewResult,
  parentJobId,
}: {
  symbols: BulkSummarySymbol[]
  onViewResult?: (jobId: string) => void
  parentJobId: string
}) {
  if (symbols.length === 0) {
    return <div className="px-4 py-3 text-xs text-muted-foreground text-center">No data</div>
  }

  return (
    <>
      <div className="grid grid-cols-[2fr_80px_80px_80px_80px_80px_80px_80px] gap-2 px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase border-b border-border bg-muted/10">
        <span>Symbol</span>
        <span className="text-right">Return</span>
        <span className="text-right">Annual</span>
        <span className="text-right">Sharpe</span>
        <span className="text-right">MaxDD</span>
        <span className="text-right">Trades</span>
        <span className="text-right">Win Rate</span>
        <span className="text-right">PF</span>
      </div>
      {symbols.map((s, i) => {
        const ret = s.total_return
        const childJobId = `${parentJobId}__${s.symbol}`
        return (
          <button
            key={`${s.symbol}-${i}`}
            onClick={() => onViewResult?.(childJobId)}
            className="grid grid-cols-[2fr_80px_80px_80px_80px_80px_80px_80px] gap-2 px-4 py-2 text-xs w-full text-left hover:bg-muted/30 transition-colors border-b border-border last:border-0"
          >
            <span className="truncate font-medium">
              {s.symbol}
              {s.symbol_name && <span className="text-muted-foreground ml-1">({s.symbol_name})</span>}
            </span>
            <span className={`text-right font-semibold ${ret !== null && ret !== undefined ? (ret >= 0 ? 'text-red-500' : 'text-green-500') : ''}`}>
              {ret !== null && ret !== undefined ? `${ret.toFixed(2)}%` : '-'}
            </span>
            <span className="text-right">
              {s.annual_return !== null && s.annual_return !== undefined ? `${s.annual_return.toFixed(2)}%` : '-'}
            </span>
            <span className="text-right">
              {s.sharpe_ratio !== null && s.sharpe_ratio !== undefined ? s.sharpe_ratio.toFixed(2) : '-'}
            </span>
            <span className="text-right text-green-500">
              {s.max_drawdown !== null && s.max_drawdown !== undefined ? `${s.max_drawdown.toFixed(2)}%` : '-'}
            </span>
            <span className="text-right">
              {s.total_trades !== null && s.total_trades !== undefined ? s.total_trades : '-'}
            </span>
            <span className="text-right">
              {s.winning_rate !== null && s.winning_rate !== undefined ? `${s.winning_rate.toFixed(1)}%` : '-'}
            </span>
            <span className="text-right">
              {s.profit_factor !== null && s.profit_factor !== undefined ? s.profit_factor.toFixed(2) : '-'}
            </span>
          </button>
        )
      })}
    </>
  )
}
