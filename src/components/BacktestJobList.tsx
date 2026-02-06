import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, Calendar, CheckCircle, ChevronDown, ChevronUp, Clock, DollarSign, Eye, Loader, Percent, Trash2, TrendingDown, TrendingUp, XCircle } from 'lucide-react'
import { useState } from 'react'
import { queueAPI } from '../lib/api'

interface BacktestJobListProps {
  onViewResults: (jobId: string) => void
}

export default function BacktestJobList({ onViewResults }: BacktestJobListProps) {
  const [filter, setFilter] = useState<string>('all')
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)
  const [jobDetails, setJobDetails] = useState<Record<string, any>>({})
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

  const toggleExpand = async (jobId: string) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null)
    } else {
      setExpandedJobId(jobId)
      // Fetch job details if not already cached
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
  }

  const jobs = jobsData?.data || []

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
            created_at: string
            progress?: number
            progress_message?: string
            error?: string
            symbol?: string
            symbol_name?: string
            strategy_class?: string
            strategy_name?: string
            start_date?: string
            end_date?: string
            initial_capital?: number
            rate?: number
            slippage?: number
            result?: {
              statistics?: {
                total_return?: number
                annual_return?: number
                sharpe_ratio?: number
                max_drawdown?: number
                max_drawdown_percent?: number
              }
            }
          }) => {
            const symbolDisplay = job.symbol_name 
              ? `${job.symbol || ''} (${job.symbol_name})`
              : job.symbol || ''
            const strategyDisplay = job.strategy_name || job.strategy_class || ''
            const isExpanded = expandedJobId === job.job_id
            const jobDetail = jobDetails[job.job_id]
            const hasStats = (job.status === 'finished' || job.status === 'completed')
            const stats = jobDetail?.result?.statistics

            return (
            <div
              key={job.job_id}
              className="bg-card border border-border rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {/* Top row: status + timestamp */}
                  <div className="flex items-center gap-3 mb-2">
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
                  </div>

                  {/* Main info row: strategy + symbol */}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    {strategyDisplay && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium">
                        <TrendingUp className="h-3 w-3" />
                        {strategyDisplay}
                      </span>
                    )}
                    {symbolDisplay && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                        {symbolDisplay}
                      </span>
                    )}
                  </div>

                  {/* Parameters row */}
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
                  </div>

                  {/* Job ID */}
                  <div className="text-xs text-muted-foreground/60 mt-1">
                    <span className="font-mono">{job.job_id}</span>
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

                <div className="flex items-center gap-2 ml-4">
                  {hasStats && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleExpand(job.job_id)
                      }}
                      className="p-2 hover:bg-muted rounded-md transition-colors"
                      title={isExpanded ? "Hide metrics" : "Show metrics"}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  )}
                  {(job.status === 'finished' || job.status === 'completed') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onViewResults(job.job_id)
                      }}
                      className="p-2 hover:bg-primary/10 text-primary rounded-md transition-colors"
                      title="View results"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(job.job_id, e)}
                    disabled={deleteMutation.isPending}
                    className="p-2 hover:bg-destructive/10 text-destructive rounded-md transition-colors disabled:opacity-50"
                    title="Delete job"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              </div>

              {/* Quick Metrics View */}
              {isExpanded && stats && (
                <div className="px-4 pb-4 border-t border-border/50 pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-muted/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Total Return</span>
                      </div>
                      <div className={`text-lg font-bold ${
                        (stats.total_return || 0) >= 0 ? 'text-red-500' : 'text-green-500'
                      }`}>
                        {(stats.total_return || 0).toFixed(2)}%
                      </div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Percent className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Annual Return</span>
                      </div>
                      <div className="text-lg font-bold">
                        {(stats.annual_return || 0).toFixed(2)}%
                      </div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Sharpe Ratio</span>
                      </div>
                      <div className="text-lg font-bold">
                        {(stats.sharpe_ratio || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Max Drawdown</span>
                      </div>
                      <div className="text-lg font-bold text-green-500">
                        {(stats.max_drawdown_percent || stats.max_drawdown || 0).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )})}
        </div>
      )}
    </div>
  )
}
