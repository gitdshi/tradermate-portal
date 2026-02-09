import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Layers, Play, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { marketDataAPI, queueAPI, strategiesAPI } from '../lib/api'
import SymbolSearch from './SymbolSearch'

interface BulkBacktestFormProps {
  onClose: () => void
  onSubmitSuccess?: (jobId: string) => void
}

interface Stock {
  symbol: string
  name: string
  vt_symbol: string
  ts_code: string
  exchange: string
  industry?: string
}

type SelectionMode = 'industry' | 'exchange' | 'manual'

export default function BulkBacktestForm({ onClose, onSubmitSuccess }: BulkBacktestFormProps) {
  const queryClient = useQueryClient()

  const [strategyId, setStrategyId] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [initialCapital, setInitialCapital] = useState('100000')
  const [rate, setRate] = useState('0.0003')
  const [slippage, setSlippage] = useState('0.0001')
  const [benchmark, setBenchmark] = useState('399300.SZ')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'basic' | 'symbols' | 'parameters'>('basic')
  const [parameters, setParameters] = useState<string>('{}')

  // Symbol selection
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('industry')
  const [selectedIndustry, setSelectedIndustry] = useState('')
  const [selectedExchange, setSelectedExchange] = useState('')
  const [selectedSymbols, setSelectedSymbols] = useState<Map<string, Stock>>(new Map())

  const benchmarkOptions = [
    { value: '399300.SZ', label: 'HS300 (沪深300)' },
  ]

  // Default dates
  useEffect(() => {
    const today = new Date()
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(today.getFullYear() - 1)
    setEndDate(today.toISOString().split('T')[0])
    setStartDate(oneYearAgo.toISOString().split('T')[0])
  }, [])

  // Strategies
  const { data: strategiesData, isLoading: isLoadingStrategies } = useQuery({
    queryKey: ['strategies'],
    queryFn: () => strategiesAPI.list(),
  })
  const strategies = strategiesData?.data || []

  useEffect(() => {
    if (!strategyId && strategies.length > 0) {
      const first = strategies.find((s: any) => s.is_active) || strategies[0]
      if (first) {
        setStrategyId(String(first.id))
        // Load strategy's default parameters
        if (first.parameters) {
          setParameters(JSON.stringify(first.parameters, null, 2))
        }
      }
    }
  }, [strategies, strategyId])

  // Update parameters when strategy changes
  useEffect(() => {
    if (strategyId) {
      const selected = strategies.find((s: any) => String(s.id) === strategyId)
      if (selected && selected.parameters && Object.keys(selected.parameters).length > 0) {
        setParameters(JSON.stringify(selected.parameters, null, 2))
      } else {
        ;(async () => {
          try {
            const resp = await strategiesAPI.get(parseInt(strategyId))
            const data = resp?.data
            const paramsObj = data?.parameters || {}
            setParameters(JSON.stringify(paramsObj, null, 2))
          } catch (e) {
            setParameters('{}')
          }
        })()
      }
    }
  }, [strategyId, strategies])

  // Sectors (industries)
  const { data: sectorsData } = useQuery({
    queryKey: ['sectors'],
    queryFn: () => marketDataAPI.sectors(),
  })
  const sectors: { name: string; count: number }[] = sectorsData?.data || []

  // Exchanges
  const { data: exchangesData } = useQuery({
    queryKey: ['exchanges'],
    queryFn: () => marketDataAPI.exchanges(),
  })
  const exchanges: { code: string; name: string; count: number }[] = exchangesData?.data || []

  // Filtered symbols (by industry or exchange)
  const filterParams = selectionMode === 'industry' && selectedIndustry
    ? { industry: selectedIndustry }
    : selectionMode === 'exchange' && selectedExchange
    ? { exchange: selectedExchange }
    : null

  const { data: filteredData, isLoading: isLoadingFiltered } = useQuery({
    queryKey: ['symbols-by-filter', filterParams],
    queryFn: () => marketDataAPI.symbolsByFilter(filterParams!),
    enabled: !!filterParams,
  })
  const filteredStocks: Stock[] = filteredData?.data || []

  

  // Select / deselect helpers
  const toggleSymbol = (stock: Stock) => {
    setSelectedSymbols(prev => {
      const next = new Map(prev)
      const key = stock.ts_code || stock.vt_symbol
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.set(key, stock)
      }
      return next
    })
  }

  const selectAll = (stocks: Stock[]) => {
    setSelectedSymbols(prev => {
      const next = new Map(prev)
      for (const s of stocks) {
        next.set(s.ts_code || s.vt_symbol, s)
      }
      return next
    })
  }

  const deselectAll = (stocks: Stock[]) => {
    setSelectedSymbols(prev => {
      const next = new Map(prev)
      for (const s of stocks) {
        next.delete(s.ts_code || s.vt_symbol)
      }
      return next
    })
  }

  const removeChip = (key: string) => {
    setSelectedSymbols(prev => {
      const next = new Map(prev)
      next.delete(key)
      return next
    })
  }

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: (data: any) => queueAPI.submitBulkBacktest(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['backtest-jobs'] })
      const jobId = response.data?.job_id
      if (onSubmitSuccess && jobId) onSubmitSuccess(jobId)
      onClose()
    },
    onError: (err: any) => {
      const resp = err?.response?.data
      let msg = 'Failed to submit bulk backtest'
      if (resp?.detail) {
        msg = typeof resp.detail === 'string' ? resp.detail : JSON.stringify(resp.detail)
      }
      setError(msg)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!strategyId) { setError('Please select a strategy'); return }
    if (selectedSymbols.size === 0) { setError('Please select at least one symbol'); return }
    if (!startDate || !endDate) { setError('Please select start and end dates'); return }
    if (new Date(startDate) >= new Date(endDate)) { setError('End date must be after start date'); return }

    // Parse parameters
    let paramsObj: Record<string, unknown> = {}
    try {
      paramsObj = parameters && parameters.trim() ? JSON.parse(parameters) : {}
    } catch (e) {
      setError('Parameters must be valid JSON')
      return
    }

    const selectedStrategy = strategies.find((s: any) => String(s.id) === strategyId)

    // Convert selected symbols to ts_code format (000001.SZ) for the backend
    const symbolList = Array.from(selectedSymbols.values()).map(s => s.ts_code || s.vt_symbol)
    // Also include symbol names for each selected symbol so backend/UI can show them per-job
    const symbolNames = Array.from(selectedSymbols.values()).map(s => s.name || '')

    submitMutation.mutate({
      strategy_id: parseInt(strategyId),
      strategy_name: selectedStrategy?.name || '',
      symbols: symbolList,
      symbol_names: symbolNames,
      start_date: startDate,
      end_date: endDate,
      parameters: paramsObj,
      initial_capital: parseFloat(initialCapital),
      rate: parseFloat(rate),
      slippage: parseFloat(slippage),
      benchmark,
    })
  }

  // Are all filtered stocks selected?
  const allFilteredSelected = filteredStocks.length > 0 && filteredStocks.every(s => selectedSymbols.has(s.ts_code || s.vt_symbol))

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Bulk Backtest</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-md transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'basic'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Basic Settings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('symbols')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'symbols'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Symbols ({selectedSymbols.size})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('parameters')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'parameters'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Strategy Parameters
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
          )}

          {/* Basic Settings Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-4">

          {/* Strategy */}
          <div>
            <label className="block text-sm font-medium mb-2">Strategy *</label>
            <select
              value={strategyId}
              onChange={(e) => setStrategyId(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              required
              disabled={isLoadingStrategies}
            >
              <option value="">{isLoadingStrategies ? 'Loading...' : 'Select a strategy'}</option>
              {strategies.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name} v{s.version || 1} ({s.class_name})
                </option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Start Date *</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">End Date *</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" required />
            </div>
          </div>

          {/* Capital */}
          <div>
            <label className="block text-sm font-medium mb-2">Initial Capital *</label>
            <input type="number" value={initialCapital} onChange={(e) => setInitialCapital(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              min="0" step="1000" required />
          </div>

          {/* Rate / slippage */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Commission Rate</label>
              <input type="number" value={rate} onChange={(e) => setRate(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                min="0" step="0.0001" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Slippage</label>
              <input type="number" value={slippage} onChange={(e) => setSlippage(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                min="0" step="0.0001" />
            </div>
          </div>

          {/* Benchmark */}
          <div>
            <label className="block text-sm font-medium mb-2">Benchmark *</label>
            <select value={benchmark} onChange={(e) => setBenchmark(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" required>
              {benchmarkOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
            </div>
          )}

          {/* Symbols Tab */}
          {activeTab === 'symbols' && (
            <div className="space-y-4">

          {/* Symbol Selection Mode */}
          <div>
            <label className="block text-sm font-medium mb-2">Symbol Selection *</label>
            <div className="flex gap-1 mb-3">
              {(['industry', 'exchange', 'manual'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSelectionMode(mode)}
                  className={`px-3 py-1.5 rounded text-sm transition-colors capitalize ${
                    selectionMode === mode
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {mode === 'industry' ? 'By Industry' : mode === 'exchange' ? 'By Exchange' : 'Manual'}
                </button>
              ))}
            </div>

            {/* Industry picker */}
            {selectionMode === 'industry' && (
              <div className="space-y-2">
                <div className="relative">
                  <select
                    value={selectedIndustry}
                    onChange={(e) => setSelectedIndustry(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select industry...</option>
                    {sectors.map(s => (
                      <option key={s.name} value={s.name}>
                        {s.name} ({s.count})
                      </option>
                    ))}
                  </select>
                </div>
                {selectedIndustry && (
                  <SymbolCheckboxList
                    stocks={filteredStocks}
                    selected={selectedSymbols}
                    loading={isLoadingFiltered}
                    allSelected={allFilteredSelected}
                    onToggle={toggleSymbol}
                    onSelectAll={() => selectAll(filteredStocks)}
                    onDeselectAll={() => deselectAll(filteredStocks)}
                  />
                )}
              </div>
            )}

            {/* Exchange picker */}
            {selectionMode === 'exchange' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  {exchanges.map(ex => (
                    <button
                      key={ex.code}
                      type="button"
                      onClick={() => setSelectedExchange(ex.code)}
                      className={`px-3 py-1.5 rounded text-sm transition-colors ${
                        selectedExchange === ex.code
                          ? 'bg-blue-500 text-white'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {ex.code} ({ex.count})
                    </button>
                  ))}
                </div>
                {selectedExchange && (
                  <SymbolCheckboxList
                    stocks={filteredStocks}
                    selected={selectedSymbols}
                    loading={isLoadingFiltered}
                    allSelected={allFilteredSelected}
                    onToggle={toggleSymbol}
                    onSelectAll={() => selectAll(filteredStocks)}
                    onDeselectAll={() => deselectAll(filteredStocks)}
                  />
                )}
              </div>
            )}

            {/* Manual search */}
            {selectionMode === 'manual' && (
              <div className="space-y-2">
                <SymbolSearch
                  multi
                  selected={selectedSymbols}
                  onToggle={(stock) => toggleSymbol(stock as Stock)}
                  placeholder="Search by code or name..."
                />
              </div>
            )}

            {/* Selected chips */}
            {selectedSymbols.size > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {selectedSymbols.size} symbol{selectedSymbols.size !== 1 ? 's' : ''} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedSymbols(new Map())}
                    className="text-xs text-destructive hover:underline"
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {Array.from(selectedSymbols.entries()).map(([key, stock]) => (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs"
                    >
                      {stock.symbol} {stock.name}
                      <button type="button" onClick={() => removeChip(key)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
            </div>
          )}

          {/* Parameters Tab */}
          {activeTab === 'parameters' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Strategy Parameters (JSON)</label>
                <textarea
                  value={parameters}
                  onChange={(e) => setParameters(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm"
                  rows={18}
                  placeholder='{\n  "param1": "value1",\n  "param2": 123\n}'
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Override strategy default parameters. Must be valid JSON format.
                </p>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
          <button type="button" onClick={onClose}
            className="px-4 py-2 border border-input rounded-md hover:bg-muted transition-colors">
            Cancel
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">params: {(() => {
              try {
                const p = parameters && parameters.trim() ? JSON.parse(parameters) : {}
                return Object.keys(p).length
              } catch (e) { return 0 }
            })()}</span>
            <button onClick={handleSubmit} disabled={submitMutation.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2">
              <Play className="h-4 w-4" />
              {submitMutation.isPending ? 'Submitting...' : `Bulk Test (${selectedSymbols.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Sub-component: checkbox list for industry/exchange mode ---------- */

function SymbolCheckboxList({
  stocks, selected, loading, allSelected, onToggle, onSelectAll, onDeselectAll,
}: {
  stocks: Stock[]
  selected: Map<string, Stock>
  loading: boolean
  allSelected: boolean
  onToggle: (s: Stock) => void
  onSelectAll: () => void
  onDeselectAll: () => void
}) {
  if (loading) return <div className="text-sm text-muted-foreground py-2">Loading symbols...</div>
  if (stocks.length === 0) return <div className="text-sm text-muted-foreground py-2">No symbols found</div>

  return (
    <div className="border border-border rounded-md">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">{stocks.length} symbols</span>
        <button
          type="button"
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="text-xs text-primary hover:underline"
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-0">
        {stocks.map(stock => {
          const key = stock.ts_code || stock.vt_symbol
          const checked = selected.has(key)
          return (
            <label
              key={key}
              className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/40 text-sm border-b border-r border-border ${
                checked ? 'bg-primary/5' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(stock)}
                className="rounded border-input"
              />
              <span className="font-mono text-xs">{stock.symbol}</span>
              <span className="text-xs text-muted-foreground truncate">{stock.name}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
