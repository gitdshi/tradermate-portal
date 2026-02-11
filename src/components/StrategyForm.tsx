import Editor from '@monaco-editor/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Maximize2, Minimize2, Save, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { strategiesAPI, strategyFilesAPI } from '../lib/api'
import type { Strategy } from '../types'

interface StrategyFormProps {
  strategy?: Strategy
  onClose: () => void
}

export default function StrategyForm({ strategy, onClose }: StrategyFormProps) {
  const queryClient = useQueryClient()
  const isEdit = !!strategy
  const [editorFullScreen, setEditorFullScreen] = useState(false)

  const [name, setName] = useState(strategy?.name || '')
  const [description, setDescription] = useState(strategy?.description || '')
  const [className, setClassName] = useState(strategy?.class_name || '')
  const [code, setCode] = useState(strategy?.code || '')
  const [isActive, setIsActive] = useState(strategy?.is_active ?? true)
  const formatParameters = (val: any): string => {
    if (val == null) return '{}'
    if (typeof val === 'object') return JSON.stringify(val, null, 2)
    // val is a string - attempt to unescape / parse common encodings
    let s = String(val).trim()
    try {
      const parsed = JSON.parse(s)
      if (typeof parsed === 'string') {
        // double-encoded JSON string
        try {
          const parsed2 = JSON.parse(parsed)
          return JSON.stringify(parsed2, null, 2)
        } catch {
          return parsed
        }
      }
      return JSON.stringify(parsed, null, 2)
    } catch {
      // fallback: try to unescape escaped quotes and newlines then parse
      const unescaped = s.replace(/\\"/g, '"').replace(/\\n/g, '\n')
      try {
        const p2 = JSON.parse(unescaped)
        return JSON.stringify(p2, null, 2)
      } catch {
        // give up and return original string (trimmed)
        return s
      }
    }
  }

  const [parameters, setParameters] = useState<string>(() => formatParameters(strategy?.parameters))
  const [error, setError] = useState('')
  const [classOptions, setClassOptions] = useState<string[] | null>(null)
  const [pendingFileContent, setPendingFileContent] = useState<string | null>(null)
  const [pendingFileName, setPendingFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const monacoRef = useRef<any>(null)
  const editorRef = useRef<any>(null)
  const lintTimer = useRef<number | null>(null)

  useEffect(() => {
    // debounce linting
    if (!monacoRef.current || !editorRef.current) return
    if (lintTimer.current) window.clearTimeout(lintTimer.current)
    lintTimer.current = window.setTimeout(async () => {
      try {
        // Try Pyright first
        let data: any = null
        try {
          const resp = await (strategyFilesAPI as any).lintPyright({ content: code })
          data = resp.data
        } catch (pyErr: any) {
          // if pyright not available (501) or other error, fallback to simple AST lint
          try {
            const resp2 = await strategyFilesAPI.lint({ content: code })
            data = resp2.data
          } catch (e) {
            data = { diagnostics: [] }
          }
        }

        const diagnostics = data?.diagnostics || []
        const markers = diagnostics.map((d: any) => {
          const line0 = d.line != null ? (typeof d.line === 'number' ? d.line + 1 : d.line) : 1
          const col = d.col != null ? d.col : 1
          const severity = d.severity === 'error' || d.severity === 'Error' ? monacoRef.current.MarkerSeverity.Error : monacoRef.current.MarkerSeverity.Warning
          return {
            startLineNumber: line0,
            startColumn: col,
            endLineNumber: line0,
            endColumn: col + 1,
            message: d.message,
            severity,
          }
        })
        const model = editorRef.current.getModel()
        if (monacoRef.current && model) {
          monacoRef.current.editor.setModelMarkers(model, 'python', markers)
        }
      } catch (e) {
        // ignore lint errors
      }
    }, 400)
    return () => { if (lintTimer.current) window.clearTimeout(lintTimer.current) }
  }, [code])

  const saveMutation = useMutation({
    mutationFn: (data: Partial<Strategy>) => {
      if (isEdit && strategy) {
        return strategiesAPI.update(strategy.id, data)
      }
      return strategiesAPI.create(data)
    },
    onSuccess: () => {
      console.debug('[StrategyForm] save success')
      // Invalidate queries to refresh strategy lists
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
      // Close modal after a brief delay to allow query to start refetching
      setTimeout(() => {
        onClose()
      }, 100)
    },
    onError: (err: unknown) => {
      const e = err as any
      console.error('[StrategyForm] save error', err)
      let parts: string[] = []

      const resp = e?.response
      if (resp?.status) parts.push(`HTTP ${resp.status}`)

      const data = resp?.data
      if (data) {
        // Common FastAPI / DRF style: { detail: ... }
        const d = data.detail ?? data.error ?? data.message ?? data
        if (Array.isArray(d)) {
          const mapped = d.map((item: any) => {
            if (typeof item === 'string') return item
            if (item?.msg) return item.msg
            if (item?.message) return item.message
            try { return JSON.stringify(item) } catch { return String(item) }
          })
          parts.push(mapped.join(', '))
        } else if (typeof d === 'object') {
          // structured field errors
          try {
            // try to pretty-format object errors
            const msgs: string[] = []
            for (const k of Object.keys(d)) {
              const v = d[k]
              if (Array.isArray(v)) msgs.push(`${k}: ${v.join(', ')}`)
              else if (typeof v === 'object') msgs.push(`${k}: ${JSON.stringify(v)}`)
              else msgs.push(`${k}: ${String(v)}`)
            }
            parts.push(msgs.join('; '))
          } catch {
            parts.push(JSON.stringify(d))
          }
        } else {
          parts.push(String(d))
        }
      }

      if (parts.length === 0) {
        // fallback to generic message or JS error
        parts.push(e?.message || 'Failed to save strategy')
      }

      setError(parts.join(' — '))
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Strategy name is required')
      return
    }

    // Code is required only when editing an existing strategy.
    if (isEdit && !code.trim()) {
      setError('Strategy code is required')
      return
    }

    // Send parameters textarea content verbatim as a string (store raw editor content)
    const paramsPayload = parameters && parameters.trim() ? parameters : undefined

    const payload: Partial<Strategy> = {
      name: name.trim(),
      description: description.trim() || undefined,
      parameters: paramsPayload as any,
    }

    // Only include class_name if not empty (required for create, optional for update)
    if (className.trim()) {
      payload.class_name = className.trim()
    }

    // Only include code if provided
    if (code.trim()) payload.code = code.trim()

    console.debug('[StrategyForm] submitting payload', payload)
    saveMutation.mutate(payload)
  }

  const handleLoadFromFileClick = () => {
    if (fileInputRef.current) fileInputRef.current.click()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('')
    const f = e.target.files && e.target.files[0]
    if (!f) return
    if (!f.name.endsWith('.py')) {
      setError('Please select a .py file')
      return
    }
    try {
      const text = await f.text()
      // send to parse endpoint
      const resp = await (strategyFilesAPI as any).parse({ content: text })
      const data = resp.data || {}
      const classes = data.classes || []
      if (classes.length === 0) {
        setError('No classes found in file')
        return
      }
      if (classes.length > 1) {
        setClassOptions(classes.map((c: any) => c.name))
        setPendingFileContent(text)
        setPendingFileName(f.name)
        return
      }

      const chosen = classes[0]

      // populate form fields
      setClassName(chosen.name || '')
      const defaults = chosen.defaults || {}
      try {
        setParameters(JSON.stringify(defaults, null, 2))
      } catch (e) {
        setParameters('{}')
      }
      setCode(text)
      // If strategy name is blank, use filename (without extension)
      try {
        const baseName = f.name.replace(/\.py$/i, '')
        setName((prev) => (prev && prev.trim() ? prev : baseName))
      } catch (e) {
        // ignore
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || String(err))
    } finally {
      // clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleClassPick = async (classNamePicked: string | null) => {
    if (!classNamePicked) {
      setClassOptions(null)
      setPendingFileContent(null)
      setPendingFileName(null)
      return
    }
    try {
      const text = pendingFileContent || ''
      const resp = await (strategyFilesAPI as any).parse({ content: text })
      const data = resp.data || {}
      const classes = data.classes || []
      const chosen = classes.find((c: any) => c.name === classNamePicked)
      if (!chosen) {
        setError('Selected class not found')
        setClassOptions(null)
        return
      }
      setClassName(chosen.name || '')
      try {
        setParameters(JSON.stringify(chosen.defaults || {}, null, 2))
      } catch (e) {
        setParameters('{}')
      }
      setCode(text)
      // use filename as strategy name if blank
      if (pendingFileName) {
        try {
          const baseName = pendingFileName.replace(/\.py$/i, '')
          setName((prev) => (prev && prev.trim() ? prev : baseName))
        } catch (e) {}
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || String(err))
    } finally {
      setClassOptions(null)
      setPendingFileContent(null)
      setPendingFileName(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const containerClass = editorFullScreen
    ? 'fixed inset-0 z-[100] bg-white dark:bg-gray-900 flex items-stretch justify-center p-0'
    : 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4'

  const dialogClass = editorFullScreen
    ? 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-none shadow-none w-full h-full overflow-hidden flex flex-col'
    : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col'

  return (
    <div className={containerClass}>
      <div className={dialogClass}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold">
            {isEdit ? `Edit Strategy${strategy?.version ? ` (v${strategy.version})` : ''}` : 'Create New Strategy'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditorFullScreen((s) => !s)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
              aria-label={editorFullScreen ? 'Exit full screen' : 'Full screen'}
            >
              {editorFullScreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body with 2-column layout */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left/Center: Code Editor */}
          <div className={`flex-1 flex flex-col border-r border-gray-200 dark:border-gray-700 ${editorFullScreen ? '' : ''}`}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-medium">
                {isEdit ? 'Strategy Code *' : 'Strategy Code (optional)'}
              </label>
            </div>
            <div className="flex-1 relative">
              <Editor
                height="100%"
                defaultLanguage="python"
                defaultValue={code}
                value={code}
                onChange={(val) => setCode(val || '')}
                onMount={(_editor, monaco) => {
                  editorRef.current = _editor
                  monacoRef.current = monaco
                  try {
                    monaco.languages.registerCompletionItemProvider('python', {
                      provideCompletionItems: (model, position) => {
                        const word = model.getWordUntilPosition(position)
                        const range = {
                          startLineNumber: position.lineNumber,
                          endLineNumber: position.lineNumber,
                          startColumn: word.startColumn,
                          endColumn: word.endColumn,
                        }
                        const suggestions = []
                        if (word.word.startsWith('imp')) {
                          suggestions.push({ label: 'import', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'import ', range })
                        }
                        return { suggestions }
                      }
                    })
                  } catch (e) {
                    // ignore
                  }
                }}
                options={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 13,
                  minimap: { enabled: !editorFullScreen },
                  automaticLayout: true,
                }}
              />
            </div>
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {isEdit ? 'Enter your VnPy strategy code here' : 'Optional strategy code — you can add code later.'}
              </p>
            </div>
          </div>

          {/* Right: Metadata & Parameters */}
          {!editorFullScreen && (
            <form onSubmit={handleSubmit} className="w-96 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 text-sm">
                    {error}
                  </div>
                )}

                {classOptions && (
                  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-40" role="dialog">
                    <div className="bg-white dark:bg-gray-800 rounded shadow-lg w-full max-w-md p-4">
                      <div className="mb-3 font-semibold">Multiple classes found — choose one</div>
                      <div className="space-y-2 max-h-60 overflow-auto">
                        {classOptions.map((n) => (
                          <button
                            key={n}
                            onClick={() => handleClassPick(n)}
                            className="w-full text-left px-3 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 text-right">
                        <button onClick={() => handleClassPick(null)} className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">Cancel</button>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-2">
                    Strategy Name *
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="My Trading Strategy"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleLoadFromFileClick}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm whitespace-nowrap"
                    >
                      Load from file
                    </button>
                    <input ref={fileInputRef} type="file" accept=".py" className="hidden" onChange={handleFileSelected} />
                  </div>
                </div>

                <div>
                  <label htmlFor="className" className="block text-sm font-medium mb-2">
                    Class Name *
                  </label>
                  <input
                    id="className"
                    type="text"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="MyStrategyClass"
                    required
                  />
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Python class name in the code</p>
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium mb-2">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Strategy description..."
                    rows={3}
                  />
                </div>

                <div>
                  <label htmlFor="parameters" className="block text-sm font-medium mb-2">
                    Default Parameters (JSON)
                  </label>
                  <textarea
                    id="parameters"
                    value={parameters}
                    onChange={(e) => setParameters(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    rows={8}
                    placeholder='{"fast_window": 5, "slow_window": 20}'
                  />
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Strategy parameters as JSON. These will be used as defaults in backtests.
                  </p>
                </div>

                {isEdit && (
                  <div className="flex items-center gap-2">
                    <input
                      id="isActive"
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
                    />
                    <label htmlFor="isActive" className="text-sm font-medium">
                      Active
                    </label>
                  </div>
                )}
              </div>

              {/* Footer buttons inside right panel */}
              <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saveMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {saveMutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

