import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, CheckCircle, Clock, DollarSign, Eye, Loader, Trash2, TrendingUp, XCircle } from 'lucide-react'
import { useState } from 'react'
import { queueAPI } from '../lib/api'

interface BacktestJobListProps {
  onViewResults: (jobId: string) => void
}

export default function BacktestJobList({ onViewResults }: BacktestJobListProps) {
  const [filter, setFilter] = useState<string>('all')
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
          }) => {
            const symbolDisplay = job.symbol_name 
              ? `${job.symbol || ''} (${job.symbol_name})`
              : job.symbol || ''
            const strategyDisplay = job.strategy_name || job.strategy_class || ''

            return (
            <div
              key={job.job_id}
              className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
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
                  {(job.status === 'finished' || job.status === 'completed') && (
                    <button
                      onClick={() => onViewResults(job.job_id)}
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
          )})}
        </div>
      )}
    </div>
  )
}
