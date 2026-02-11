import { diffLines } from 'diff'
import {
    Edit2,
    GitCompare,
    Plus,
    RefreshCw,
    Save,
    Trash2,
    TrendingUp,
    X
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import StrategyForm from '../components/StrategyForm'
import StrategyOptimization from '../components/StrategyOptimization'
import { strategiesAPI, strategyCodeAPI, strategyFilesAPI } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import type { Strategy, StrategyComparison, StrategyFile, StrategyFileContent, SyncResult } from '../types'

type TabType = 'files' | 'optimize'

export default function Strategies() {
  const [activeTab, setActiveTab] = useState<TabType>('files')
  
  // DB-backed strategy state
  const [dbStrategies, setDbStrategies] = useState<Strategy[]>([])
  const [selectedDbStrategy, setSelectedDbStrategy] = useState<Strategy | null>(null)
  
  // File-based strategy state
  const [fileStrategies, setFileStrategies] = useState<StrategyFile[]>([])
  const [comparisons, setComparisons] = useState<StrategyComparison[]>([])
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState<'data' | 'project' | 'both'>('data')
  const [fileView, setFileView] = useState<'list' | 'compare'>('list')
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null)
  const [strategyContent, setStrategyContent] = useState<StrategyFileContent | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [editName, setEditName] = useState('')
  const [editClassName, setEditClassName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editParameters, setEditParameters] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [showDbForm, setShowDbForm] = useState(false)
  const [newStrategyName, setNewStrategyName] = useState('')
  const [newStrategyContent, setNewStrategyContent] = useState(`"""VNPy CTA Strategy Template."""

from vnpy_ctastrategy import (
    CtaTemplate,
    StopOrder,
    Direction,
    TickData,
    BarData,
    TradeData,
    OrderData,
    BarGenerator,
    ArrayManager,
)


class MyStrategy(CtaTemplate):
    """Custom trading strategy following VNPy CTA format."""
    
    author = "TraderMate"
    
    # Strategy parameters
    fast_window = 10
    slow_window = 20
    fixed_size = 1
    
    # Strategy variables (for display)
    fast_ma = 0.0
    slow_ma = 0.0
    
    parameters = ["fast_window", "slow_window", "fixed_size"]
    variables = ["fast_ma", "slow_ma"]
    
    def __init__(self, cta_engine, strategy_name, vt_symbol, setting):
        """Initialize strategy."""
        super().__init__(cta_engine, strategy_name, vt_symbol, setting)
        
        self.bg = BarGenerator(self.on_bar)
        self.am = ArrayManager()
    
    def on_init(self):
        """Called when strategy is initialized."""
        self.write_log("Strategy initialized")
        self.load_bar(10)
    
    def on_start(self):
        """Called when strategy is started."""
        self.write_log("Strategy started")
    
    def on_stop(self):
        """Called when strategy is stopped."""
        self.write_log("Strategy stopped")
    
    def on_tick(self, tick: TickData):
        """Called on every tick."""
        self.bg.update_tick(tick)
    
    def on_bar(self, bar: BarData):
        """Called on every bar."""
        self.am.update_bar(bar)
        if not self.am.inited:
            return
        
        # Calculate indicators
        self.fast_ma = self.am.sma(self.fast_window)
        self.slow_ma = self.am.sma(self.slow_window)
        
        # Update variables for display
        self.put_event()
        
        # Trading logic example
        if self.pos == 0:
            if self.fast_ma > self.slow_ma:
                self.buy(bar.close_price, self.fixed_size)
        elif self.pos > 0:
            if self.fast_ma < self.slow_ma:
                self.sell(bar.close_price, abs(self.pos))
    
    def on_order(self, order: OrderData):
        """Called when order status updates."""
        pass
    
    def on_trade(self, trade: TradeData):
        """Called when trade is executed."""
        self.put_event()
    
    def on_stop_order(self, stop_order: StopOrder):
        """Called when stop order is triggered."""
        pass
`)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editorFullScreen, setEditorFullScreen] = useState(false)
  const editFileInputRef = useRef<HTMLInputElement | null>(null)
  const [classOptionsEdit, setClassOptionsEdit] = useState<string[] | null>(null)
  const [pendingEditFileContent, setPendingEditFileContent] = useState<string | null>(null)
  const [pendingEditFileName, setPendingEditFileName] = useState<string | null>(null)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyModalContent, setHistoryModalContent] = useState<{name: string, versionName: string, content: string, strategyName?: string | null, className?: string | null, historyVersion?: string | null, parameters?: any} | null>(null)
  const [showDiff, setShowDiff] = useState(true)

  const formatParameters = (val: any): string => {
    if (val == null) return '{}'
    if (typeof val === 'object') return JSON.stringify(val, null, 2)
    let s = String(val).trim()
    try {
      const parsed = JSON.parse(s)
      if (typeof parsed === 'string') {
        try {
          const parsed2 = JSON.parse(parsed)
          return JSON.stringify(parsed2, null, 2)
        } catch {
          return parsed
        }
      }
      return JSON.stringify(parsed, null, 2)
    } catch {
      const unescaped = s.replace(/\\"/g, '"').replace(/\\n/g, '\n')
      try {
        const p2 = JSON.parse(unescaped)
        return JSON.stringify(p2, null, 2)
      } catch {
        return s
      }
    }
  }

  useEffect(() => {
    if (activeTab === 'files') {
      loadDbStrategies()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const navigate = useNavigate()
  const { logout } = useAuthStore()

  const loadDbStrategies = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data } = await strategiesAPI.list()
      console.log('[Strategies] Loaded strategies:', data)
      setDbStrategies(data)
      
      // Auto-select first strategy if none selected and strategies exist
      if (data.length > 0 && !selectedDbStrategy) {
        console.log('[Strategies] Auto-selecting first strategy:', data[0].id)
        // Fetch full strategy details including code
        const fullStrategy = await strategiesAPI.get(data[0].id)
        setSelectedDbStrategy(fullStrategy.data)
        await loadDbStrategyHistory(data[0].id)
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string }, status?: number } }
      console.error('[Strategies] Failed to load strategies:', err)
      if (error.response?.status === 401) {
        try { logout() } catch (e) {}
        navigate('/login')
        return
      }
      setError(error.response?.data?.detail || 'Failed to load strategies')
    } finally {
      setLoading(false)
    }
  }

  const loadFileStrategies = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data } = await strategyFilesAPI.list(source)
      setFileStrategies(data)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Failed to load strategies')
    } finally {
      setLoading(false)
    }
  }

  const loadComparisons = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data } = await strategyFilesAPI.compare()
      setComparisons(data)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Failed to load comparisons')
    } finally {
      setLoading(false)
    }
  }

  const handleEditLoadFromFileClick = () => {
    if (editFileInputRef.current) editFileInputRef.current.click()
  }

  const handleEditFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const f = e.target.files && e.target.files[0]
    if (!f) return
    if (!f.name.endsWith('.py')) {
      setError('Please select a .py file')
      return
    }
    try {
      const text = await f.text()
      const resp = await (strategyFilesAPI as any).parse({ content: text })
      const data = resp.data || {}
      const classes = data.classes || []
      if (classes.length === 0) {
        setError('No classes found in file')
        return
      }
      if (classes.length > 1) {
        setClassOptionsEdit(classes.map((c: any) => c.name))
        setPendingEditFileContent(text)
        setPendingEditFileName(f.name)
        return
      }

      const chosen = classes[0]

      // populate edit fields
      setEditClassName(chosen.name || '')
      try {
        setEditParameters(JSON.stringify(chosen.defaults || {}, null, 2))
      } catch (e) {
        setEditParameters('{}')
      }
      setEditContent(text)
      // If edit name is blank, use filename (without extension)
      try {
        const baseName = f.name.replace(/\.py$/i, '')
        setEditName((prev) => (prev && prev.trim() ? prev : baseName))
      } catch (e) {
        // ignore
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || String(err))
    } finally {
      if (editFileInputRef.current) editFileInputRef.current.value = ''
    }
  }

  const viewFileStrategy = async (name: string, source: 'data' | 'project' = 'data') => {
    try {
      setError(null)
      // Clear history when switching strategies
      setHistoryVersions([])
      const { data } = await strategyFilesAPI.get(name, source)
      setStrategyContent(data)
      setEditContent(data.content)
      setSelectedStrategy(name)
      setIsEditing(false)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Failed to load strategy content')
    }
  }

  const handleEditClassPick = async (classNamePicked: string | null) => {
    if (!classNamePicked) {
      setClassOptionsEdit(null)
      setPendingEditFileContent(null)
      setPendingEditFileName(null)
      return
    }
    try {
      const text = pendingEditFileContent || ''
      const resp = await (strategyFilesAPI as any).parse({ content: text })
      const data = resp.data || {}
      const classes = data.classes || []
      const chosen = classes.find((c: any) => c.name === classNamePicked)
      if (!chosen) {
        setError('Selected class not found')
        setClassOptionsEdit(null)
        return
      }
      setEditClassName(chosen.name || '')
      try {
        setEditParameters(JSON.stringify(chosen.defaults || {}, null, 2))
      } catch (e) {
        setEditParameters('{}')
      }
      setEditContent(text)
      if (pendingEditFileName) {
        try {
          const baseName = pendingEditFileName.replace(/\.py$/i, '')
          setEditName((prev) => (prev && prev.trim() ? prev : baseName))
        } catch (e) {}
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || String(err))
    } finally {
      setClassOptionsEdit(null)
      setPendingEditFileContent(null)
      setPendingEditFileName(null)
      if (editFileInputRef.current) editFileInputRef.current.value = ''
    }
  }

  const [historyVersions, setHistoryVersions] = useState<Array<{name:string,path:string,mtime:string,size:string}>>([])
  const [dbStrategyHistory, setDbStrategyHistory] = useState<Array<{id:number, code?:string, created_at:string, strategy_name?: string | null, class_name?: string | null, version?: number | null, parameters?: any, size?: number}>>([])

  const loadHistory = async (name: string, source: 'data' | 'project' = 'data') => {
    try {
      console.log(`Loading history for: ${name}, source: ${source}`)
      const { data } = await strategyFilesAPI.listHistory(name, source)
      console.log(`History loaded:`, data)
      setHistoryVersions(data || [])
    } catch (err) {
      console.error(`Failed to load history for ${name}:`, err)
      setHistoryVersions([])
    }
  }

  const loadDbStrategyHistory = async (strategyId: number) => {
    try {
      console.log(`Loading history for strategy id: ${strategyId}`)
      const { data } = await strategyCodeAPI.listCodeHistory(strategyId)
      console.log(`DB Strategy history loaded:`, data)
      setDbStrategyHistory(data || [])
    } catch (err) {
      console.error(`Failed to load history for strategy ${strategyId}:`, err)
      setDbStrategyHistory([])
    }
  }

  const viewHistoryVersion = async (name: string, versionName: string, source: 'data' | 'project' = 'data') => {
    try {
      const { data } = await strategyFilesAPI.getHistoryContent(name, versionName, source)
      setHistoryModalContent({ name, versionName, content: data.content, strategyName: data.strategy_name ?? null, className: data.class_name ?? null, historyVersion: data.version ?? null, parameters: formatParameters(data.parameters ?? null) })
      setShowHistoryModal(true)
    } catch (err) {
      setError('Failed to load history version')
    }
  }

  const viewDbHistoryVersion = async (strategyId: number, name: string, historyId: number) => {
    try {
      const { data } = await strategyCodeAPI.getCodeHistory(strategyId, historyId)
      // Prefer metadata returned from history row; fallback to strategies.version or history id
      let versionLabel = `Version #${historyId}`
      if (data?.version) {
        versionLabel = `v${data.version}`
      } else {
        try {
          const sresp = await strategiesAPI.get(strategyId)
          const strat = sresp?.data
          if (strat && strat.version !== undefined) versionLabel = `v${strat.version}`
        } catch (e) {
          // ignore and fallback to history id
        }
      }
      setHistoryModalContent({ name, versionName: versionLabel, content: data.code, strategyName: data.strategy_name ?? null, className: data.class_name ?? null, historyVersion: data.version ?? null, parameters: formatParameters(data.parameters ?? null) })
      setShowHistoryModal(true)
    } catch (err) {
      setError('Failed to load history version')
    }
  }

  const restoreDbHistoryVersion = async (strategyId: number, historyId: number, strategyName: string) => {
    // Resolve a human-friendly version label from the strategies table if available
    let versionLabel = `#${historyId}`
    try {
      const r = await strategiesAPI.get(strategyId)
      const s = r?.data
      if (s && s.version !== undefined) versionLabel = `v${s.version}`
    } catch (e) {
      // fallback
    }
    if (!confirm(`Restore version ${versionLabel} to '${strategyName}'?`)) return
    try {
      await strategyCodeAPI.restoreCodeHistory(strategyId, historyId)
      setSuccess('Version restored successfully')
      // Reload strategy and history
      await loadDbStrategies()
      const res = await strategiesAPI.get(strategyId)
      setSelectedDbStrategy(res.data)
      await loadDbStrategyHistory(strategyId)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Failed to restore version')
    }
  }

  const recoverHistoryVersion = async (name: string, versionName: string, source: 'data' | 'project' = 'data') => {
    if (!confirm(`Restore version ${versionName} to '${name}.py'?`)) return
    try {
      await strategyFilesAPI.recoverHistory(name, versionName, source)
      setSuccess('Recovered version successfully')
      await loadFileStrategies()
      await viewFileStrategy(name, source)
      await loadHistory(name, source)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Failed to recover version')
    }
  }

  const saveFileStrategy = async () => {
    if (!selectedStrategy) return

    try {
      setError(null)
      await strategyFilesAPI.update(selectedStrategy, { content: editContent, source: 'data' })
      setSuccess('Strategy updated successfully')
      setIsEditing(false)
      setEditorFullScreen(false)
      await loadFileStrategies()
      await viewFileStrategy(selectedStrategy)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Failed to update strategy')
    }
  }

  const createFileStrategy = async () => {
    if (!newStrategyName.trim()) {
      setError('Strategy name is required')
      return
    }

    try {
      setError(null)
      await strategyFilesAPI.create({
        name: newStrategyName,
        content: newStrategyContent,
        source: 'data'
      })
      setSuccess('Strategy created successfully')
      setIsCreating(false)
      setEditorFullScreen(false)
      setNewStrategyName('')
      setNewStrategyContent('')
      await loadFileStrategies()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Failed to create strategy')
    }
  }

  const deleteFileStrategy = async (name: string, source: 'data' | 'project' = 'data') => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return

    try {
      setError(null)
      await strategyFilesAPI.delete(name, source)
      setSuccess('Strategy deleted successfully')
      setSelectedStrategy(null)
      setStrategyContent(null)
      await loadFileStrategies()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Failed to delete strategy')
    }
  }

  const deleteDbStrategy = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This will delete the strategy and all associated files.`)) return

    try {
      setError(null)
      await strategiesAPI.delete(id)
      setSuccess('Strategy deleted successfully')
      setSelectedDbStrategy(null)
      await loadDbStrategies()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Failed to delete strategy')
    }
  }

  const syncStrategies = async (direction: 'bidirectional' | 'data_to_project' | 'project_to_data' = 'bidirectional') => {
    try {
      setSyncing(true)
      setError(null)
      const { data }: { data: SyncResult } = await strategyFilesAPI.sync(direction)
      const msg = `Synced: ${data.copied_to_data} to data, ${data.copied_to_project} to project, ${data.unchanged} unchanged`
      setSuccess(msg)
      await loadFileStrategies()
      if (fileView === 'compare') await loadComparisons()
      setTimeout(() => setSuccess(null), 5000)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setError(error.response?.data?.detail || 'Failed to sync strategies')
    } finally {
      setSyncing(false)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      synced: 'bg-green-100 text-green-800',
      data_newer: 'bg-blue-100 text-blue-800',
      project_newer: 'bg-yellow-100 text-yellow-800',
      different: 'bg-orange-100 text-orange-800',
      data_only: 'bg-purple-100 text-purple-800',
      project_only: 'bg-pink-100 text-pink-800',
    }
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace('_', ' ')}
      </span>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
      {/* Header */}
      {!editorFullScreen && (
        <div className="flex items-center justify-between mb-6 page-header">
        <div>
          <h1 className="text-3xl font-bold">Strategies</h1>
          <p className="text-muted-foreground mt-2">
            Manage your trading strategies
          </p>
        </div>
        </div>
      )}

      {/* Tabs */}
      {!editorFullScreen && (
        <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('files')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'files'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Strategies
          </button>
          <button
            onClick={() => setActiveTab('optimize')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'optimize'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Optimize
          </button>
        </nav>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-800 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-800 rounded">
          {success}
        </div>
      )}
      {classOptionsEdit && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-40" role="dialog">
          <div className="bg-white dark:bg-gray-800 rounded shadow-lg w-full max-w-md p-4">
            <div className="mb-3 font-semibold">Multiple classes found — choose one</div>
            <div className="space-y-2 max-h-60 overflow-auto">
              {classOptionsEdit.map((n) => (
                <button key={n} onClick={() => handleEditClassPick(n)} className="w-full text-left px-3 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-3 text-right">
              <button onClick={() => handleEditClassPick(null)} className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Strategy Files Tab */}
      {activeTab === 'files' && (
        <>
          {/* Toolbar */}
          {!editorFullScreen && (
            <div className="mb-6 flex items-center gap-4 flex-wrap">
            <button
              onClick={() => {
                setSelectedDbStrategy(null)
                setShowDbForm(true)
              }}
              className="px-4 py-2 bg-green-600 text-white rounded flex items-center gap-2 hover:bg-green-700"
            >
              <Plus size={16} />
              New Strategy
            </button>

            <button
              onClick={loadDbStrategies}
              disabled={loading}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded flex items-center gap-2 hover:bg-gray-200 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>

          </div>
          )}

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-280px)]">
            {/* List/Compare Panel */}
            <div className={`bg-white rounded-lg shadow lg:col-span-4 overflow-hidden flex flex-col ${editorFullScreen ? 'hidden' : ''}`}>
              {fileView === 'list' ? (
                <div className="p-4 flex flex-col h-full overflow-hidden">
                  <h2 className="text-lg font-semibold mb-4 flex-shrink-0">Strategies ({dbStrategies.length})</h2>
                  {loading ? (
                    <div className="text-center py-8 text-gray-500">Loading...</div>
                  ) : dbStrategies.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No strategies found</div>
                  ) : (
                    <div className="space-y-2 overflow-y-auto flex-1">
                      {dbStrategies.map((strategy) => (
                        <div key={strategy.id}>
                          <div
                            className={`p-3 border rounded hover:bg-gray-50 cursor-pointer ${
                              selectedDbStrategy?.id === strategy.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                            }`}
                            onClick={async () => {
                              console.log('[Strategies] Selected strategy:', strategy)
                              // Fetch full strategy details including code
                              try {
                                const fullStrategy = await strategiesAPI.get(strategy.id)
                                setSelectedDbStrategy(fullStrategy.data)
                                await loadDbStrategyHistory(strategy.id)
                              } catch (err) {
                                console.error('[Strategies] Failed to load strategy details:', err)
                                setError('Failed to load strategy details')
                              }
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-medium text-gray-900">{strategy.name}</h3>
                                  <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 text-xs font-medium">
                                    v{strategy.version}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-500">
                                  {strategy.class_name}
                                </p>
                                {strategy.description && (
                                  <p className="text-xs text-gray-400 mt-1">{strategy.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    // Fetch full strategy details before opening form
                                    try {
                                      const fullStrategy = await strategiesAPI.get(strategy.id)
                                      setSelectedDbStrategy(fullStrategy.data)
                                      setShowDbForm(true)
                                    } catch (err) {
                                      console.error('[Strategies] Failed to load strategy for edit:', err)
                                      setError('Failed to load strategy details')
                                    }
                                  }}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                  title="Edit"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteDbStrategy(strategy.id, strategy.name)
                                  }}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                                  title="Delete"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* History subsection */}
                          {selectedDbStrategy?.id === strategy.id && (
                            <div className="mt-2 p-3 border-l-2 border-blue-300 bg-blue-50 rounded-r">
                              {dbStrategyHistory.length === 0 ? (
                                <div className="text-sm text-gray-500 italic">No history versions available</div>
                              ) : (
                                <>
                                  <h4 className="text-sm font-medium mb-2">History Versions</h4>
                                  <div className="space-y-2 text-sm text-gray-700">
                                    {dbStrategyHistory.map((v) => (
                                      <div key={v.id} className="flex items-center justify-between">
                                        <div>
                                          <div className="font-mono text-xs">{v.version !== null && v.version !== undefined ? `v${v.version}` : `Version #${v.id}`}</div>
                                          <div className="text-xs text-gray-500">{new Date(v.created_at).toLocaleString()}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => viewDbHistoryVersion(strategy.id, strategy.name, v.id)}
                                            className="px-2 py-1 bg-white border rounded text-xs hover:bg-gray-50"
                                          >
                                            View
                                          </button>
                                          <button
                                            onClick={() => restoreDbHistoryVersion(strategy.id, v.id, strategy.name)}
                                            className="px-2 py-1 bg-blue-600 text-white border rounded text-xs hover:bg-blue-700"
                                          >
                                            Restore
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Details Panel */}
            <div className={`bg-white rounded-lg shadow lg:col-span-8 overflow-hidden flex flex-col ${editorFullScreen ? 'fixed inset-0 z-50 rounded-none' : ''}`}>
              {selectedDbStrategy && selectedDbStrategy.id ? (
                <div className="flex flex-col h-full" key={`strategy-${selectedDbStrategy.id}`}>
                  <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold">{selectedDbStrategy.name}</h2>
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 text-xs font-medium">
                        v{selectedDbStrategy.version}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isEditing ? (
                        <>
                          <button
                            onClick={() => {
                              setIsEditing(true)
                              setEditContent(selectedDbStrategy.code || '')
                              setEditName(selectedDbStrategy.name)
                              setEditClassName(selectedDbStrategy.class_name)
                              setEditDescription(selectedDbStrategy.description || '')
                              setEditParameters(formatParameters(selectedDbStrategy.parameters))
                              setEditorFullScreen(true)
                            }}
                            className="px-3 py-2 bg-blue-600 text-white rounded flex items-center gap-2 hover:bg-blue-700"
                          >
                            <Edit2 size={16} />
                            Edit
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              try {
                                const updatePayload: any = {}
                                
                                // Only send fields that have changed and are not empty
                                if (editName.trim() && editName !== selectedDbStrategy.name) {
                                  updatePayload.name = editName.trim()
                                }
                                if (editClassName.trim() && editClassName !== selectedDbStrategy.class_name) {
                                  updatePayload.class_name = editClassName.trim()
                                }
                                if (editDescription.trim() !== (selectedDbStrategy.description || '')) {
                                  updatePayload.description = editDescription.trim()
                                }
                                
                                // Send parameters if changed — compare raw editor text to stored representation
                                try {
                                  const existingString = typeof selectedDbStrategy.parameters === 'string' ? selectedDbStrategy.parameters : JSON.stringify(selectedDbStrategy.parameters || {}, null, 2)
                                  const newString = editParameters || ''
                                  if (existingString !== newString) {
                                    updatePayload.parameters = newString
                                  }
                                } catch (e) {
                                  // Fallback: send raw editor contents if comparison fails
                                  updatePayload.parameters = editParameters
                                }

                                // Always send code if it has content OR if it explicitly changed
                                const normalizedExisting = selectedDbStrategy.code || ''
                                const normalizedEdit = editContent || ''
                                if (normalizedEdit !== normalizedExisting) {
                                  if (normalizedEdit.trim() !== '') {
                                    // User has typed code - always send it
                                    updatePayload.code = normalizedEdit
                                    console.debug('[Save] Sending updated code')
                                  } else if (normalizedExisting.trim() !== '') {
                                    // User is explicitly clearing existing code
                                    updatePayload.code = ''
                                    console.debug('[Save] Clearing code')
                                  }
                                  // else: both are empty, no need to send
                                }
                                
                                console.log('[Save] Update payload:', updatePayload)
                                
                                await strategiesAPI.update(selectedDbStrategy.id, updatePayload)
                                setSuccess('Strategy updated successfully')
                                setIsEditing(false)
                                setEditorFullScreen(false)
                                await loadDbStrategies()
                                const updated = await strategiesAPI.get(selectedDbStrategy.id)
                                setSelectedDbStrategy(updated.data)
                                // Refresh DB-backed history versions after saving
                                await loadDbStrategyHistory(updated.data.id)
                                setTimeout(() => setSuccess(null), 3000)
                              } catch (err: unknown) {
                                const error = err as { response?: { data?: { detail?: string | any[] } } }
                                console.error('[Save] Error:', err)
                                console.error('[Save] Error response:', error.response)
                                let errorMessage = 'Failed to update strategy'
                                if (error.response?.data?.detail) {
                                  if (Array.isArray(error.response.data.detail)) {
                                    errorMessage = error.response.data.detail.map((e: any) => 
                                      typeof e === 'string' ? e : (e.msg || JSON.stringify(e))
                                    ).join(', ')
                                  } else {
                                    errorMessage = error.response.data.detail
                                  }
                                }
                                setError(errorMessage)
                              }
                            }}
                            className="px-3 py-2 bg-green-600 text-white rounded flex items-center gap-2 hover:bg-green-700"
                          >
                            <Save size={16} />
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setIsEditing(false)
                              setEditContent('')
                              setEditName('')
                              setEditClassName('')
                              setEditDescription('')
                              setEditParameters('')
                              setEditorFullScreen(false)
                            }}
                            className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() => {
                          setSelectedDbStrategy(null)
                          setIsEditing(false)
                          setEditorFullScreen(false)
                        }}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>

                  {!isEditing ? (
                    <div className="space-y-4 p-4 overflow-y-auto flex-1">
                      {/* Class Name, Description, Status on one line */}
                      <div className="flex items-center gap-4 pb-3 border-b flex-shrink-0">
                        <div className="flex-shrink-0">
                          <span className="text-sm font-medium text-gray-500">Class:</span>
                          <span className="ml-2 text-base font-medium text-gray-900">{selectedDbStrategy.class_name}</span>
                        </div>
                        
                        {selectedDbStrategy.description && (
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-500">Description:</span>
                            <span className="ml-2 text-base text-gray-700 truncate">{selectedDbStrategy.description}</span>
                          </div>
                        )}
                      </div>

                      {(selectedDbStrategy.parameters && ((typeof selectedDbStrategy.parameters === 'string' && (selectedDbStrategy.parameters as string).trim() !== '') || (typeof selectedDbStrategy.parameters === 'object' && Object.keys(selectedDbStrategy.parameters).length > 0))) && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Parameters</label>
                          <pre className="mt-2 p-3 bg-gray-50 rounded border border-gray-200 overflow-x-auto text-xs">
                            <code>{typeof selectedDbStrategy.parameters === 'string' ? selectedDbStrategy.parameters : JSON.stringify(selectedDbStrategy.parameters, null, 2)}</code>
                          </pre>
                        </div>
                      )}

                      {selectedDbStrategy.code ? (
                        <div className="flex-shrink-0">
                          <label className="text-sm font-medium text-gray-600 mb-2 block">Code</label>
                          <div className="border border-gray-300 rounded overflow-auto max-h-[500px]">
                            <SyntaxHighlighter
                              language="python"
                              style={vscDarkPlus}
                              customStyle={{ margin: 0, fontSize: '13px' }}
                              showLineNumbers
                            >
                              {selectedDbStrategy.code}
                            </SyntaxHighlighter>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="text-sm font-medium text-gray-600 mb-2 block">Code</label>
                          <div className="p-8 text-center text-gray-500 border border-gray-200 rounded bg-gray-50">
                            <p>No code available for this strategy.</p>
                            <button
                              onClick={() => {
                                setIsEditing(true)
                                setEditContent('')
                                setEditName(selectedDbStrategy.name)
                                setEditClassName(selectedDbStrategy.class_name)
                                setEditDescription(selectedDbStrategy.description || '')
                                setEditParameters(formatParameters(selectedDbStrategy.parameters))
                                setEditorFullScreen(true)
                              }}
                              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                            >
                              Add Code
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t text-sm">
                        <div>
                          <label className="text-xs font-medium text-gray-500">Created</label>
                          <p className="text-gray-800">{new Date(selectedDbStrategy.created_at).toLocaleString()}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500">Updated</label>
                          <p className="text-gray-800">{new Date(selectedDbStrategy.updated_at).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-1 overflow-hidden absolute inset-0 top-[57px]">
                      {/* Left: Code Editor */}
                      <div className="flex-1 flex flex-col border-r border-gray-300 overflow-hidden">
                        <div className="px-4 py-2 border-b border-gray-200 flex-shrink-0">
                          <label className="text-sm font-medium text-gray-700">Code</label>
                        </div>
                        <div className="flex-1 relative overflow-auto">
                          <div className="relative" style={{minHeight: '100%'}}>
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="absolute inset-0 w-full h-full px-3 py-2 font-mono text-sm focus:outline-none bg-transparent z-10 resize-none overflow-auto"
                              spellCheck={false}
                              style={{ color: 'transparent', caretColor: 'white' }}
                            />
                            <SyntaxHighlighter
                              language="python"
                              style={vscDarkPlus}
                              customStyle={{ margin: 0, fontSize: '13px', pointerEvents: 'none', minHeight: '100%' }}
                              showLineNumbers
                            >
                              {editContent || '# Enter your strategy code here'}
                            </SyntaxHighlighter>
                          </div>
                        </div>
                      </div>

                      {/* Right: Metadata & Parameters */}
                      <div className="w-96 flex flex-col overflow-hidden flex-shrink-0 bg-gray-50 border-l border-gray-300">
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Strategy Name</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                  type="button"
                                  onClick={handleEditLoadFromFileClick}
                                  className="px-3 py-2 border border-gray-300 rounded bg-white hover:bg-gray-100 text-sm whitespace-nowrap"
                                >
                                  Load from file
                                </button>
                                <input ref={editFileInputRef} type="file" accept=".py" className="hidden" onChange={handleEditFileSelected} />
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
                              <input
                                type="text"
                                value={editClassName}
                                onChange={(e) => setEditClassName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g., MyStrategy"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                              <textarea
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows={3}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Default Parameters (JSON)</label>
                              <textarea
                                value={editParameters}
                                onChange={(e) => setEditParameters(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                rows={10}
                                placeholder='{"fast_window": 5, "slow_window": 20}'
                              />
                              <p className="text-xs text-gray-500 mt-1">Strategy parameters as JSON. Used as defaults in backtests.</p>
                            </div>
                          </div>
                        </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 h-full flex items-center justify-center text-gray-500">
                  Select a strategy to view or create a new one
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Optimize Tab */}
      {activeTab === 'optimize' && (
        <div>
          <StrategyOptimization />
        </div>
      )}

      {/* History Version Modal */}
      {showDbForm && (
        <StrategyForm
          strategy={selectedDbStrategy || undefined}
          onClose={async () => {
            setShowDbForm(false)
            // Capture id before we potentially clear selection
            const editedId = selectedDbStrategy?.id
            // Refresh the strategies list
            await loadDbStrategies()
            if (editedId) {
              // Reload the updated strategy and its history
              const res = await strategiesAPI.get(editedId)
              setSelectedDbStrategy(res.data)
              await loadDbStrategyHistory(editedId)
            } else {
              setSelectedDbStrategy(null)
            }
          }}
        />
      )}

      {showHistoryModal && historyModalContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowHistoryModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-xl font-semibold">{historyModalContent.name}</h2>
                <p className="text-sm text-gray-500">Version: {historyModalContent.versionName}</p>
                <div className="text-sm text-gray-500 mt-1">
                  {historyModalContent.strategyName && <div>Strategy: {historyModalContent.strategyName}</div>}
                  {historyModalContent.className && <div>Class: {historyModalContent.className}</div>}
                  {historyModalContent.historyVersion && <div>History: {historyModalContent.historyVersion}</div>}
                </div>
                {historyModalContent.parameters && (
                  <div className="mt-2">
                    <div className="text-xs font-medium text-gray-700">Parameters</div>
                    <pre className="text-xs font-mono whitespace-pre-wrap bg-gray-50 p-2 rounded mt-1">{typeof historyModalContent.parameters === 'string' ? historyModalContent.parameters : JSON.stringify(historyModalContent.parameters, null, 2)}</pre>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDiff(!showDiff)}
                  className={`px-3 py-1 rounded flex items-center gap-2 ${showDiff ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  <GitCompare size={16} />
                  {showDiff ? 'Hide Diff' : 'Show Diff'}
                </button>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="p-2 hover:bg-gray-100 rounded"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {showDiff && (strategyContent || selectedDbStrategy) ? (
                <div className="p-4">
                  <div className="mb-2 text-sm font-medium text-gray-700">Changes from current version:</div>
                  <div className="border rounded overflow-hidden">
                    {diffLines(
                      strategyContent?.content || selectedDbStrategy?.code || '', 
                      historyModalContent.content
                    ).map((part, index) => {
                      const bgColor = part.added ? 'bg-green-100' : part.removed ? 'bg-red-100' : 'bg-white'
                      const textColor = part.added ? 'text-green-800' : part.removed ? 'text-red-800' : 'text-gray-800'
                      const prefix = part.added ? '+ ' : part.removed ? '- ' : '  '
                      return (
                        <div key={index} className={`${bgColor} ${textColor}`}>
                          {part.value.split('\n').map((line, lineIndex) => (
                            line && <div key={lineIndex} className="px-3 py-0.5 font-mono text-xs whitespace-pre">{prefix}{line}</div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <SyntaxHighlighter
                  language="python"
                  style={vscDarkPlus}
                  customStyle={{ margin: 0, borderRadius: 0, fontSize: '13px' }}
                  showLineNumbers
                >
                  {historyModalContent.content}
                </SyntaxHighlighter>
              )}
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
