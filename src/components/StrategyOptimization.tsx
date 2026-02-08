import { useMutation, useQuery } from '@tanstack/react-query'
import { Calendar, DollarSign, Play, TrendingUp, X } from 'lucide-react'
import { useState } from 'react'
import { api } from '../lib/api'
import type { Strategy } from '../types'

interface OptimizationParams {
  strategy_id: number
  symbol: string
  start_date: string
  end_date: string
  initial_capital: number
  parameters: Record<string, {
    min: number
    max: number
    step: number
  }>
}

interface OptimizationResult {
  job_id: string
  status: string
  best_params?: Record<string, number>
  best_result?: {
    total_return: number
    sharpe_ratio: number
    max_drawdown: number
  }
  all_results?: Array<{
    params: Record<string, number>
    metrics: {
      total_return: number
      sharpe_ratio: number
      max_drawdown: number
    }
  }>
}

export default function StrategyOptimization() {
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    strategy_id: '',
    symbol: '',
    start_date: '',
    end_date: '',
    initial_capital: 100000,
  })
  const [paramRanges, setParamRanges] = useState<Record<string, { min: number; max: number; step: number }>>({})
  const [optimizationJobId, setOptimizationJobId] = useState<string | null>(null)

  // Fetch strategies
  const { data: strategiesData } = useQuery({
    queryKey: ['strategies'],
    queryFn: async () => {
      const { data } = await api.get('/api/strategies')
      return data
    },
  })

  const strategies: Strategy[] = strategiesData || []

  // Fetch optimization result
  const { data: optimizationResult } = useQuery<OptimizationResult>({
    queryKey: ['optimization', optimizationJobId],
    queryFn: async () => {
      const { data } = await api.get(`/api/optimization/${optimizationJobId}`)
      return data
    },
    enabled: !!optimizationJobId,
    refetchInterval: (query) => {
      if (query.state.data?.status === 'finished' || query.state.data?.status === 'failed') {
        return false
      }
      return 3000
    },
  })

  // Submit optimization
  const optimizationMutation = useMutation({
    mutationFn: async (params: OptimizationParams) => {
      const { data } = await api.post('/api/optimization', params)
      return data
    },
    onSuccess: (data) => {
      setOptimizationJobId(data.job_id)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    optimizationMutation.mutate({
      strategy_id: parseInt(formData.strategy_id),
      symbol: formData.symbol,
      start_date: formData.start_date,
      end_date: formData.end_date,
      initial_capital: formData.initial_capital,
      parameters: paramRanges,
    })
  }

  const addParameter = () => {
    const paramName = prompt('Enter parameter name:')
    if (paramName) {
      setParamRanges({
        ...paramRanges,
        [paramName]: { min: 0, max: 100, step: 1 },
      })
    }
  }

  const removeParameter = (paramName: string) => {
    const newRanges = { ...paramRanges }
    delete newRanges[paramName]
    setParamRanges(newRanges)
  }

  const updateParamRange = (paramName: string, field: 'min' | 'max' | 'step', value: number) => {
    setParamRanges({
      ...paramRanges,
      [paramName]: {
        ...paramRanges[paramName],
        [field]: value,
      },
    })
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
      >
        <TrendingUp className="w-5 h-5" />
        Optimize Strategy
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-900">Strategy Optimization</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Configuration Form */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuration</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Strategy
                  </label>
                  <select
                    value={formData.strategy_id}
                    onChange={(e) => setFormData({ ...formData, strategy_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Strategy</option>
                    {strategies.map((strategy) => (
                      <option key={strategy.id} value={strategy.id}>
                        {strategy.name} v{strategy.version}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Symbol
                  </label>
                  <input
                    type="text"
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                    placeholder="e.g., AAPL"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    Initial Capital
                  </label>
                  <input
                    type="number"
                    value={formData.initial_capital}
                    onChange={(e) => setFormData({ ...formData, initial_capital: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Parameter Ranges */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Parameter Ranges
                    </label>
                    <button
                      type="button"
                      onClick={addParameter}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      + Add Parameter
                    </button>
                  </div>

                  <div className="space-y-3">
                    {Object.entries(paramRanges).map(([paramName, range]) => (
                      <div key={paramName} className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm text-gray-700">{paramName}</span>
                          <button
                            type="button"
                            onClick={() => removeParameter(paramName)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="number"
                            placeholder="Min"
                            value={range.min}
                            onChange={(e) => updateParamRange(paramName, 'min', parseFloat(e.target.value))}
                            className="px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                          <input
                            type="number"
                            placeholder="Max"
                            value={range.max}
                            onChange={(e) => updateParamRange(paramName, 'max', parseFloat(e.target.value))}
                            className="px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                          <input
                            type="number"
                            placeholder="Step"
                            value={range.step}
                            onChange={(e) => updateParamRange(paramName, 'step', parseFloat(e.target.value))}
                            className="px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={optimizationMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
                >
                  <Play className="w-5 h-5" />
                  {optimizationMutation.isPending ? 'Starting...' : 'Start Optimization'}
                </button>
              </form>
            </div>

            {/* Right: Results */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Results</h3>
              
              {!optimizationResult && (
                <div className="text-center text-gray-500 py-8">
                  Configure parameters and start optimization to see results
                </div>
              )}

              {optimizationResult && (
                <div className="space-y-4">
                  {/* Status */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Status</div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        optimizationResult.status === 'finished' ? 'bg-green-100 text-green-800' :
                        optimizationResult.status === 'failed' ? 'bg-red-100 text-red-800' :
                        optimizationResult.status === 'started' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {optimizationResult.status}
                      </span>
                    </div>
                  </div>

                  {/* Best Parameters */}
                  {optimizationResult.best_params && (
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <div className="text-sm font-medium text-green-900 mb-2">Best Parameters</div>
                      <div className="space-y-2">
                        {Object.entries(optimizationResult.best_params).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-sm">
                            <span className="text-gray-700">{key}:</span>
                            <span className="font-medium text-gray-900">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Best Results */}
                  {optimizationResult.best_result && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white p-3 rounded-lg border border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">Total Return</div>
                        <div className={`text-lg font-bold ${optimizationResult.best_result.total_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {optimizationResult.best_result.total_return.toFixed(2)}%
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">Sharpe Ratio</div>
                        <div className="text-lg font-bold text-blue-600">
                          {optimizationResult.best_result.sharpe_ratio.toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">Max Drawdown</div>
                        <div className="text-lg font-bold text-red-600">
                          {optimizationResult.best_result.max_drawdown.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  )}

                  {/* All Results Table */}
                  {optimizationResult.all_results && optimizationResult.all_results.length > 0 && (
                    <div className="mt-4">
                      <div className="text-sm font-medium text-gray-900 mb-2">
                        All Results ({optimizationResult.all_results.length})
                      </div>
                      <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Params</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Return</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Sharpe</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {optimizationResult.all_results.map((result, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-xs text-gray-900">
                                  {Object.entries(result.params).map(([k, v]) => `${k}:${v}`).join(', ')}
                                </td>
                                <td className={`px-3 py-2 text-xs text-right font-medium ${result.metrics.total_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {result.metrics.total_return.toFixed(2)}%
                                </td>
                                <td className="px-3 py-2 text-xs text-right text-gray-900">
                                  {result.metrics.sharpe_ratio.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
