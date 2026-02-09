import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Maximize2, Minimize2, Save, X } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import Editor, { OnMount } from '@monaco-editor/react'
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
  const [parameters, setParameters] = useState<string>(() =>
    strategy?.parameters ? JSON.stringify(strategy.parameters, null, 2) : '{}'
  )
  const [error, setError] = useState('')
  const monacoRef = useRef<any>(null)
  const editorRef = useRef<any>(null)
  const lintTimer = useRef<number | null>(null)

  useEffect(() => {
    // debounce linting
    if (!monacoRef.current || !editorRef.current) return
    if (lintTimer.current) window.clearTimeout(lintTimer.current)
    lintTimer.current = window.setTimeout(async () => {
      try {
        const res = await strategyFilesAPI.list ? null : null
        // call lint endpoint
        const { data } = await strategyFilesAPI.lint({ content: code })
        const diagnostics = data.diagnostics || []
        const markers = (diagnostics || []).map((d: any) => ({
          startLineNumber: d.line || 1,
          startColumn: d.col || 1,
          endLineNumber: d.line || 1,
          endColumn: (d.col || 1) + 1,
          message: d.message,
          severity: d.severity === 'error' ? monacoRef.current.MarkerSeverity.Error : monacoRef.current.MarkerSeverity.Warning,
        }))
        const model = editorRef.current.getModel()
        monacoRef.current.editor.setModelMarkers(model, 'python', markers)
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
      const error = err as { response?: { data?: { detail?: string } } }
      console.error('[StrategyForm] save error', err)
      // Handle different error response formats
      let errorMessage = 'Failed to save strategy'
      if (error.response?.data?.detail) {
        if (Array.isArray(error.response.data.detail)) {
          errorMessage = error.response.data.detail.map((e: any) => 
            typeof e === 'string' ? e : e.msg || JSON.stringify(e)
          ).join(', ')
        } else if (typeof error.response.data.detail === 'object') {
          errorMessage = JSON.stringify(error.response.data.detail)
        } else {
          errorMessage = error.response.data.detail
        }
      }
      setError(errorMessage)
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

    // Parse parameters JSON
    let paramsObj: Record<string, unknown> = {}
    try {
      paramsObj = parameters && parameters.trim() ? JSON.parse(parameters) : {}
    } catch (e) {
      setError('Parameters must be valid JSON')
      return
    }

    const payload: Partial<Strategy> = {
      name: name.trim(),
      description: description.trim() || undefined,
      parameters: paramsObj,
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

  const containerClass = editorFullScreen
    ? 'fixed inset-0 z-[100] bg-white dark:bg-gray-900 flex items-stretch justify-center p-0'
    : 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4'

  const dialogClass = editorFullScreen
    ? 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-none shadow-none w-full h-full overflow-hidden flex flex-col'
    : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col'

  return (
    <div className={containerClass}>
      <div className={dialogClass}>
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 text-sm">
              {error}
            </div>
          )}

          {!editorFullScreen && (
            <>
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Strategy Name *
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="My Trading Strategy"
                  required
                />
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
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Enter the Python class name defined in the strategy code.</p>
              </div>

              <div>
                <label htmlFor="parameters" className="block text-sm font-medium mb-2">
                  Parameters (JSON)
                </label>
                <textarea
                  id="parameters"
                  value={parameters}
                  onChange={(e) => setParameters(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  rows={6}
                  placeholder='{"param1": 10, "flag": true}'
                />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Optional JSON object defining strategy parameters.</p>
              </div>
            </>
          )}

          <div className="flex-1 flex flex-col">
            <label htmlFor="code" className="block text-sm font-medium mb-2">
              {isEdit ? 'Strategy Code *' : 'Strategy Code (optional)'}
            </label>
            <div className={`border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden flex-1 ${editorFullScreen ? '' : ''}`}>
              <Editor
                height={editorFullScreen ? 'calc(100vh - 240px)' : '400px'}
                defaultLanguage="python"
                defaultValue={code}
                value={code}
                onChange={(val) => setCode(val || '')}
                onMount={(_editor, monaco) => {
                  editorRef.current = _editor
                  monacoRef.current = monaco
                  // register completion provider (calls simple suggestions)
                  try {
                    monaco.languages.registerCompletionItemProvider('python', {
                      provideCompletionItems: (model, position) => {
                        // simple local provider returning import suggestions based on current words
                        const word = model.getWordUntilPosition(position)
                        const range = {
                          startLineNumber: position.lineNumber,
                          endLineNumber: position.lineNumber,
                          startColumn: word.startColumn,
                          endColumn: word.endColumn,
                        }
                        const suggestions = []
                        // basic suggestions
                        if (word.word.startsWith('imp')) {
                          suggestions.push({ label: 'import', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'import ' , range})
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
                  minimap: { enabled: false },
                  automaticLayout: true,
                }}
              />
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {isEdit ? 'Enter your VnPy strategy code here' : 'Optional strategy code — you can add code later.'}
            </p>
          </div>

          {isEdit && !editorFullScreen && (
            <div className="flex items-center gap-2">
              <input
                id="isActive"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
              />
              <label htmlFor="isActive" className="text-sm font-medium">
                Active (enable this strategy for trading)
              </label>
            </div>
          )}
        </form>

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
      </div>
    </div>
  )
}

