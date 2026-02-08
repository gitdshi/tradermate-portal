import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Pencil, Power, PowerOff, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { strategiesAPI } from '../lib/api'
import type { Strategy } from '../types'

interface StrategyListProps {
  onEdit: (strategy: Strategy) => void
  onView: (strategy: Strategy) => void
}

export default function StrategyList({ onEdit, onView }: StrategyListProps) {
  const queryClient = useQueryClient()
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data: strategiesData, isLoading } = useQuery({
    queryKey: ['strategies'],
    queryFn: () => strategiesAPI.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => strategiesAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
      setDeleteId(null)
    },
  })

  const strategies = strategiesData?.data || []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading strategies...</div>
      </div>
    )
  }

  if (strategies.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No strategies yet</p>
        <p className="text-sm text-muted-foreground">
          Create your first strategy to get started
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {strategies.map((strategy: Strategy) => (
        <div
          key={strategy.id}
          className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold">{strategy.name}</h3>
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
                  {strategy.is_active ? (
                    <span className="flex items-center gap-1">
                      <Power className="h-3 w-3" />
                      Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <PowerOff className="h-3 w-3" />
                      Inactive
                    </span>
                  )}
                </span>
              </div>
              {strategy.description && (
                <p className="text-sm text-muted-foreground mb-3">
                  {strategy.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>ID: {strategy.id}</span>
                <span>
                  Created: {new Date(strategy.created_at).toLocaleDateString()}
                </span>
                {strategy.parameters && Object.keys(strategy.parameters).length > 0 && (
                  <span>
                    Parameters: {Object.keys(strategy.parameters).length}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={() => onView(strategy)}
                className="p-2 hover:bg-muted rounded-md transition-colors"
                title="View details"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={() => onEdit(strategy)}
                className="p-2 hover:bg-muted rounded-md transition-colors"
                title="Edit strategy"
              >
                <Pencil className="h-4 w-4" />
              </button>
              {deleteId === strategy.id ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => deleteMutation.mutate(strategy.id)}
                    className="px-3 py-1 bg-destructive text-destructive-foreground rounded text-xs hover:bg-destructive/90"
                    disabled={deleteMutation.isPending}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setDeleteId(null)}
                    className="px-3 py-1 bg-muted rounded text-xs hover:bg-muted/80"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteId(strategy.id)}
                  className="p-2 hover:bg-destructive/10 text-destructive rounded-md transition-colors"
                  title="Delete strategy"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
