export interface User {
  id: number
  username: string
  email: string
  created_at: string
}

export interface Strategy {
  id: number
  name: string
  class_name?: string
  description?: string
  code: string
  user_id: number
  version: number
  is_active: boolean
  parameters?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface BacktestRequest {
  strategy_id?: number
  strategy_class?: string
  symbol: string
  symbol_name?: string
  strategy_name?: string
  start_date: string
  end_date: string
  initial_capital: number
  rate?: number
  slippage?: number
  size?: number
  pricetick?: number
  benchmark?: string
  parameters?: Record<string, unknown>
}

export interface BacktestResult {
  job_id: string
  status: 'queued' | 'started' | 'finished' | 'failed' | 'cancelled'
  symbol: string
  symbol_name?: string
  strategy_name?: string
  start_date: string
  end_date: string
  initial_capital: number
  benchmark?: string
  statistics?: {
    total_return: number
    annual_return: number
    max_drawdown: number
    sharpe_ratio: number
    total_trades: number
    winning_rate: number
    profit_factor: number
  }
  trades?: unknown[]
  completed_at?: string
  error?: string
}

export interface Job {
  job_id: string
  user_id: number
  type: 'backtest' | 'batch_backtest' | 'optimization'
  status: 'queued' | 'started' | 'finished' | 'failed' | 'cancelled'
  progress: number
  progress_message: string
  created_at: string
  updated_at: string
  result?: unknown
  symbol_name?: string
  strategy_name?: string
  strategy_version?: number
}

export interface QueueStats {
  queues: Record<string, {
    queued: number
    failed: number
    finished: number
    started: number
  }>
}

export interface StrategyFile {
  name: string
  filename: string
  source: 'data' | 'project'
  path: string
  size: number
  modified: number
  hash: string
}

export interface StrategyFileContent {
  name: string
  content: string
}

export interface StrategyFileCreate {
  name: string
  content: string
  source?: 'data' | 'project'
}

export interface StrategyFileUpdate {
  content: string
  source?: 'data' | 'project'
}

export interface SyncResult {
  copied_to_data: number
  copied_to_project: number
  unchanged: number
  errors: string[]
}

export interface StrategyComparison {
  name: string
  status: 'synced' | 'data_newer' | 'project_newer' | 'different' | 'data_only' | 'project_only'
  data: StrategyFile | null
  project: StrategyFile | null
}
