import { Calendar, Code, Settings, User, X } from 'lucide-react'
import type { Strategy } from '../types'

interface StrategyViewModalProps {
  strategy: Strategy
  onClose: () => void
  onEdit: () => void
}

export default function StrategyViewModal({ strategy, onClose, onEdit }: StrategyViewModalProps) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">{strategy.name}</h2>
            <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-medium">
              v{strategy.version}
            </span>
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                strategy.is_active
                  ? 'bg-green-500/10 text-green-500'
                  : 'bg-gray-500/10 text-gray-500'
              }`}
            >
              {strategy.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-md transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {strategy.description && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
              <p className="text-sm">{strategy.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">User ID:</span>
              <span>{strategy.user_id}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Created:</span>
              <span>{new Date(strategy.created_at).toLocaleString()}</span>
            </div>
          </div>

          {strategy.parameters && Object.keys(strategy.parameters).length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Parameters</h3>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                {Object.entries(strategy.parameters).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{key}:</span>
                    <span className="text-muted-foreground">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Code className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Strategy Code</h3>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 overflow-x-auto">
              <pre className="text-xs font-mono">{strategy.code}</pre>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-input rounded-md hover:bg-muted transition-colors"
          >
            Close
          </button>
          <button
            onClick={onEdit}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Edit Strategy
          </button>
        </div>
      </div>
    </div>
  )
}
