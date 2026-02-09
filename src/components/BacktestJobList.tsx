import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, BarChart3, Calendar, CheckCircle, ChevronDown, ChevronRight, Clock, DollarSign, Eye, Layers, Loader, Trash2, TrendingUp, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { queueAPI } from '../lib/api'
import type { BulkJobChildResult, BulkJobResultsPage } from '../types'

interface BacktestJobListProps {
  onViewResults: (jobId: string) => void
  onViewBulkSummary?: (jobId: string) => void
}

export default function BacktestJobList({ onViewResults, onViewBulkSummary }: BacktestJobListProps) {
  const [filter, setFilter] = useState<string>('all')
  const [jobDetails, setJobDetails] = useState<Record<string, any>>({})
  const [expandedBulk, setExpandedBulk] = useState<Record<string, boolean>>({})
  const queryClient = useQueryClient()

  const { data: jobsData, isLoading } = useQuery({
    queryKey: ['backtest-jobs', filter],
    queryFn: () => queueAPI.listJobs(filter === 'all' ? undefined : filter, 50),
    refetchInterval: 5000, // Refresh every 5 seconds
  })

  const deleteMutation = useMutation({
    mutationFn: (jobId: string) => queueAPI.deleteJob(jobId),
    onSuccess: () => {
      // Refetch the jobs list after successful deletion
      queryClient.invalidateQueries({ queryKey: ['backtest-jobs'] })
    },
  })

  const handleDelete = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this backtest job?')) {
      deleteMutation.mutate(jobId)
    }
  }

  const fetchJobDetails = async (jobId: string) => {
    if (!jobDetails[jobId]) {
      try {
        const response = await queueAPI.getJob(jobId)
        setJobDetails(prev => ({
          ...prev,
          [jobId]: response.data
        }))
      } catch (error) {
        console.error('Failed to fetch job details:', error)
      }
    }
  }

  const jobs = jobsData?.data || []

  // Auto-fetch details for completed jobs
  useEffect(() => {
    if (jobs && jobs.length > 0) {
      jobs.forEach((job: any) => {
        if ((job.status === 'finished' || job.status === 'completed') && !jobDetails[job.job_id]) {
          fetchJobDetails(job.job_id)
        }
      })
    }
  }, [jobs])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'started':
        return <Loader className="h-4 w-4 text-blue-500 animate-spin" />
      case 'finished':
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'queued':
        return 'bg-yellow-500/10 text-yellow-500'
      case 'started':
        return 'bg-blue-500/10 text-blue-500'
      case 'finished':
      case 'completed':
        return 'bg-green-500/10 text-green-500'
      case 'failed':
        return 'bg-red-500/10 text-red-500'
      default:
        return 'bg-gray-500/10 text-gray-500'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            filter === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('queued')}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            filter === 'queued'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          }`}
        >
          Queued
        </button>
        <button
          onClick={() => setFilter('started')}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            filter === 'started'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          }`}
        >
          Running
        </button>
        <button
          onClick={() => setFilter('finished')}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            filter === 'finished'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          }`}
        >
          Finished
        </button>
        <button
          onClick={() => setFilter('failed')}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            filter === 'failed'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          }`}
        >
          Failed
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-lg">
          <p className="text-muted-foreground">No backtest jobs found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job: {
            job_id: string
            status: string
            type?: string
            created_at: string
            progress?: number
            progress_message?: string
            error?: string
            symbol?: string
            symbol_name?: string
            symbols?: string[]
            total_symbols?: number
            strategy_class?: string
            strategy_name?: string
            strategy_version?: number
            start_date?: string
            end_date?: string
            initial_capital?: number
            rate?: number
            slippage?: number
            result?: {
              best_return?: number
              best_symbol?: string
              statistics?: {
                total_return?: number
                annual_return?: number
                sharpe_ratio?: number
                max_drawdown?: number
                max_drawdown_percent?: number
              }
            }
          }) => {
            const isBulk = job.job_id.startsWith('bulk_') || job.type === 'bulk_backtest'

            if (isBulk) {
              return (
                <BulkJobCard
                  key={job.job_id}
                  job={job}
                  expanded={!!expandedBulk[job.job_id]}
                  onToggle={() => setExpandedBulk(prev => ({ ...prev, [job.job_id]: !prev[job.job_id] }))}
                  onDelete={(e) => handleDelete(job.job_id, e)}
                  deleteIsPending={deleteMutation.isPending}
                  onViewResults={onViewResults}
                  onViewBulkSummary={onViewBulkSummary}
                  getStatusIcon={getStatusIcon}
                  getStatusColor={getStatusColor}
                />
              )
            }

            // -------- Single backtest card (unchanged) --------
            const symbolDisplay = job.symbol_name 
              ? `${job.symbol || ''} (${job.symbol_name})`
              : job.symbol || ''
            const strategyDisplay = job.strategy_name || job.strategy_class || ''
            const strategyVersion = job.strategy_version
            const jobDetail = jobDetails[job.job_id]
            const hasStats = (job.status === 'finished' || job.status === 'completed')
            const stats = jobDetail?.result?.statistics
            // parameters may come from job metadata or from the saved result
            const jobParams = (job as any).parameters || (jobDetail?.result && (jobDetail.result as any).parameters) || {}

            return (
              <div
                key={job.job_id}
                className="bg-card border border-border rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="p-4">
                  {/* Line 1: status + timestamp + job ID (full width) */}
                  <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                    {getStatusIcon(job.status)}
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getStatusColor(
                        job.status
                      )}`}
                    >
                      {job.status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(job.created_at).toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground/60 font-mono">
                      {job.job_id}
                    </span>
                  </div>

                  {/* Lines 2-3: left info + right metrics/buttons */}
                  <div className="flex items-center justify-between gap-4">
                    {/* Left: line 2 strategy+symbol, line 3 parameters */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {strategyDisplay && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium">
                            <TrendingUp className="h-3 w-3" />
                            {strategyDisplay}
                            {strategyVersion && (
                              <span className="ml-1 px-1 py-0 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-semibold">
                                v{strategyVersion}
                              </span>
                            )}
                          </span>
                        )}
                        {symbolDisplay && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                            {symbolDisplay}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {job.start_date && job.end_date && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {job.start_date} ~ {job.end_date}
                          </span>
                        )}
                        {job.initial_capital && (
                          <span className="inline-flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {Number(job.initial_capital).toLocaleString()}
                          </span>
                        )}
                        {job.rate !== undefined && (
                          <span>Rate: {job.rate}</span>
                        )}
                        {job.slippage !== undefined && (
                          <span>Slip: {job.slippage}</span>
                        )}
                        {/* Parameters summary */}
                        {(jobParams && Object.keys(jobParams).length > 0) && (
                          <span className="inline-flex items-center gap-1">
                            <Layers className="h-3 w-3" />
                            Params: {Object.keys(jobParams).length}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: metrics + buttons in one row, vertically centered with left lines 2-3 */}
                    {hasStats && stats ? (
                      <div className="flex-shrink-0 flex items-center gap-3">
                        <div className={`text-lg font-extrabold ${
                            (stats.total_return || 0) >= 0 ? 'text-red-500' : 'text-green-500'
                          }`}>
                            <span className="text-sm text-muted-foreground font-normal mr-2">Return</span>
                            {(stats.total_return || 0).toFixed(2)}%
                          </div>
                          <div className="text-lg font-extrabold">
                            <span className="text-sm text-muted-foreground font-normal mr-2">Annual</span>
                            {(stats.annual_return || 0).toFixed(2)}%
                          </div>
                          <div className="text-lg font-extrabold">
                            <span className="text-sm text-muted-foreground font-normal mr-2">Sharpe</span>
                            {(stats.sharpe_ratio || 0).toFixed(2)}
                          </div>
                          <div className="text-lg font-extrabold text-green-500">
                            <span className="text-sm text-muted-foreground font-normal mr-2">MaxDD</span>
                            {(stats.max_drawdown_percent || stats.max_drawdown || 0).toFixed(2)}%
                          </div>
                        <div className="flex items-center gap-2 ml-2 border-l border-border pl-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onViewResults(job.job_id)
                            }}
                            className="px-3 py-2 hover:bg-primary/10 text-primary rounded-md transition-colors text-sm font-medium"
                            title="View results"
                          >
                            <Eye className="h-5 w-5" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(job.job_id, e)}
                            disabled={deleteMutation.isPending}
                            className="px-3 py-2 hover:bg-destructive/10 text-destructive rounded-md transition-colors disabled:opacity-50 text-sm font-medium"
                            title="Delete job"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    ) : hasStats ? (
                      <div className="flex-shrink-0 flex items-center px-4">
                        <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="flex-shrink-0 flex items-center gap-1">
                        {(job.status === 'finished' || job.status === 'completed') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onViewResults(job.job_id)
                            }}
                            className="px-3 py-2 hover:bg-primary/10 text-primary rounded-md transition-colors text-sm font-medium"
                            title="View results"
                          >
                            <Eye className="h-5 w-5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDelete(job.job_id, e)}
                          disabled={deleteMutation.isPending}
                          className="px-3 py-2 hover:bg-destructive/10 text-destructive rounded-md transition-colors disabled:opacity-50 text-sm font-medium"
                          title="Delete job"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {job.progress !== undefined && job.progress > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>{job.progress_message || 'Processing...'}</span>
                        <span>{job.progress}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {job.error && (
                    <div className="text-sm text-destructive mt-2">
                      Error: {job.error}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


/* ========== Bulk Job Card with expandable child results ========== */

function BulkJobCard({
  job,
  expanded,
  onToggle,
  onDelete,
  deleteIsPending,
  onViewResults,
  onViewBulkSummary,
  getStatusIcon,
  getStatusColor,
}: {
  job: any
  expanded: boolean
  onToggle: () => void
  onDelete: (e: React.MouseEvent) => void
  deleteIsPending: boolean
  onViewResults: (jobId: string) => void
  onViewBulkSummary?: (jobId: string) => void
  getStatusIcon: (s: string) => React.ReactNode
  getStatusColor: (s: string) => string
}) {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [allResults, setAllResults] = useState<BulkJobChildResult[]>([])
  const [total, setTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const PAGE_SIZE = 10

  const strategyDisplay = job.strategy_name || job.strategy_class || ''
  const strategyVersion = job.strategy_version
  const totalSymbols = job.total_symbols || job.symbols?.length || 0
  const hasFinished = job.status === 'finished' || job.status === 'completed'
  const bestReturn = job.result?.best_return
  const bestSymbol = job.result?.best_symbol
  // parameters for bulk job (may be present on job or inside result)
  const jobParams = job.parameters || (job.result && (job.result as any).parameters) || {}

  // Fetch first page when expanded
  useEffect(() => {
    if (expanded && allResults.length === 0 && hasFinished) {
      loadPage(1)
    }
  }, [expanded])

  // Reset when sort order changes
  useEffect(() => {
    if (expanded && hasFinished) {
      setAllResults([])
      setPage(1)
      loadPage(1)
    }
  }, [sortOrder])

  const loadPage = async (p: number) => {
    setLoadingMore(true)
    try {
      const res = await queueAPI.getBulkJobResults(job.job_id, p, PAGE_SIZE, sortOrder)
      const data: BulkJobResultsPage = res.data
      if (p === 1) {
        setAllResults(data.results)
      } else {
        setAllResults(prev => [...prev, ...data.results])
      }
      setTotal(data.total)
      setPage(p)
    } catch (err) {
      console.error('Failed to load bulk results', err)
    } finally {
      setLoadingMore(false)
    }
  }

  const hasMore = allResults.length < total

  return (
    <div className="bg-card border border-border rounded-lg hover:shadow-md transition-shadow">
      <div className="p-4">
        {/* Line 1: status + timestamp + job ID */}
        <div className="flex items-center gap-3 mb-1.5 flex-wrap">
          {getStatusIcon(job.status)}
          <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getStatusColor(job.status)}`}>
            {job.status}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-semibold">
            <Layers className="h-3 w-3" />
            Bulk
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(job.created_at).toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground/60 font-mono">{job.job_id}</span>
        </div>

        {/* Line 2-3: strategy + params + metrics */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {strategyDisplay && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium">
                  <TrendingUp className="h-3 w-3" />
                  {strategyDisplay}
                  {strategyVersion && (
                    <span className="ml-1 px-1 py-0 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-semibold">
                      v{strategyVersion}
                    </span>
                  )}
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-medium">
                {totalSymbols} symbols
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {job.start_date && job.end_date && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {job.start_date} ~ {job.end_date}
                </span>
              )}
              {job.initial_capital && (
                <span className="inline-flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {Number(job.initial_capital).toLocaleString()}
                </span>
              )}
              {job.rate !== undefined && <span>Rate: {job.rate}</span>}
              {job.slippage !== undefined && <span>Slip: {job.slippage}</span>}
              {/* Parameters summary for bulk job */}
              {(jobParams && Object.keys(jobParams).length > 0) && (
                <span className="inline-flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  Params: {Object.keys(jobParams).length}
                </span>
              )}
            </div>
          </div>

          {/* Right: best return metrics + buttons */}
          <div className="flex-shrink-0 flex items-center gap-3">
            {hasFinished && bestReturn !== undefined && bestReturn !== null && (
              <div className="flex items-center gap-3">
                <div>
                  <div className={`text-lg font-extrabold ${bestReturn >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                    <span className="text-sm text-muted-foreground font-normal mr-1">Return</span>
                    {bestReturn.toFixed(2)}%
                  </div>
                  {bestSymbol && (
                    <div className="text-[10px] text-muted-foreground text-right">
                      {bestSymbol}
                      {job.result?.best_symbol_name ? (
                        <span className="text-[10px] text-muted-foreground/80 ml-1">({job.result.best_symbol_name})</span>
                      ) : null}
                    </div>
                  )}
                </div>
                {job.result?.best_annual_return !== undefined && (
                  <div className="text-lg font-extrabold">
                    <span className="text-sm text-muted-foreground font-normal mr-1">Annual</span>
                    {job.result.best_annual_return.toFixed(2)}%
                  </div>
                )}
                {job.result?.best_sharpe_ratio !== undefined && (
                  <div className="text-lg font-extrabold">
                    <span className="text-sm text-muted-foreground font-normal mr-1">Sharpe</span>
                    {job.result.best_sharpe_ratio.toFixed(2)}
                  </div>
                )}
                {job.result?.best_max_drawdown !== undefined && (
                  <div className="text-lg font-extrabold text-green-500">
                    <span className="text-sm text-muted-foreground font-normal mr-1">MaxDD</span>
                    {job.result.best_max_drawdown.toFixed(2)}%
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-1 border-l border-border pl-3">
              {hasFinished && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggle() }}
                  className="px-3 py-2 hover:bg-primary/10 text-primary rounded-md transition-colors text-sm font-medium"
                  title={expanded ? 'Collapse results' : 'Expand results'}
                >
                  {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </button>
              )}
              {hasFinished && onViewBulkSummary && (
                <button
                  onClick={(e) => { e.stopPropagation(); onViewBulkSummary(job.job_id) }}
                  className="px-3 py-2 hover:bg-primary/10 text-primary rounded-md transition-colors text-sm font-medium"
                  title="View summary"
                >
                  <BarChart3 className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={onDelete}
                disabled={deleteIsPending}
                className="px-3 py-2 hover:bg-destructive/10 text-destructive rounded-md transition-colors disabled:opacity-50 text-sm font-medium"
                title="Delete bulk job"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Progress bar (while running) */}
        {job.progress !== undefined && job.progress > 0 && job.progress < 100 && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>{job.progress_message || 'Processing...'}</span>
              <span>{job.progress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${job.progress}%` }} />
            </div>
          </div>
        )}

        {job.error && (
          <div className="text-sm text-destructive mt-2">Error: {job.error}</div>
        )}
      </div>

      {/* Expanded child results */}
      {expanded && hasFinished && (
        <div className="border-t border-border">
          {/* Sort control */}
          <div className="flex items-center justify-between px-4 py-2 bg-muted/20">
            <span className="text-xs text-muted-foreground">{total} results</span>
            <button
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Return {sortOrder === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
            </button>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[1fr_80px_80px_80px_80px_60px] gap-2 px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase border-b border-border bg-muted/10">
            <span>Symbol</span>
            <span className="text-right">Return</span>
            <span className="text-right">Annual</span>
            <span className="text-right">Sharpe</span>
            <span className="text-right">MaxDD</span>
            <span className="text-right">Status</span>
          </div>

          {/* Rows */}
          {allResults.map((child) => {
            const childParams = (child as any).parameters || {}
            const ret = child.statistics?.total_return
            return (
              <button
                key={child.job_id}
                onClick={() => onViewResults(child.job_id)}
                className="grid grid-cols-[1fr_80px_80px_80px_80px_60px] gap-2 px-4 py-2 text-xs w-full text-left hover:bg-muted/30 transition-colors border-b border-border last:border-0"
              >
                <span className="truncate font-medium">
                  {child.symbol}
                  {child.symbol_name && <span className="text-muted-foreground ml-1">({child.symbol_name})</span>}
                  {childParams && Object.keys(childParams).length > 0 && (
                    <span className="text-[10px] text-muted-foreground ml-2">Params: {Object.keys(childParams).length}</span>
                  )}
                </span>
                <span className={`text-right font-semibold ${ret !== undefined ? (ret >= 0 ? 'text-red-500' : 'text-green-500') : ''}`}>
                  {ret !== undefined ? `${ret.toFixed(2)}%` : '-'}
                </span>
                <span className="text-right">
                  {child.statistics?.annual_return !== undefined ? `${child.statistics.annual_return.toFixed(2)}%` : '-'}
                </span>
                <span className="text-right">
                  {child.statistics?.sharpe_ratio !== undefined ? child.statistics.sharpe_ratio.toFixed(2) : '-'}
                </span>
                <span className="text-right text-green-500">
                  {child.statistics?.max_drawdown_percent !== undefined
                    ? `${child.statistics.max_drawdown_percent.toFixed(2)}%`
                    : child.statistics?.max_drawdown !== undefined
                    ? `${child.statistics.max_drawdown.toFixed(2)}%`
                    : '-'}
                </span>
                <span className={`text-right capitalize ${child.status === 'completed' || child.status === 'finished' ? 'text-green-500' : child.status === 'failed' ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {child.status === 'completed' || child.status === 'finished' ? '✓' : child.status === 'failed' ? '✗' : child.status}
                </span>
              </button>
            )
          })}

          {/* Load more */}
          {hasMore && (
            <div className="px-4 py-2 text-center border-t border-border">
              <button
                onClick={() => loadPage(page + 1)}
                disabled={loadingMore}
                className="text-sm text-primary hover:underline disabled:opacity-50"
              >
                {loadingMore ? 'Loading...' : `... load more (${allResults.length}/${total})`}
              </button>
            </div>
          )}

          {loadingMore && allResults.length === 0 && (
            <div className="px-4 py-4 text-center">
              <Loader className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}