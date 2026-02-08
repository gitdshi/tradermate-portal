import { Layers, Play } from 'lucide-react'
import { useState } from 'react'
import BacktestForm from '../components/BacktestForm'
import BacktestJobList from '../components/BacktestJobList'
import BacktestResults from '../components/BacktestResults'
import BulkBacktestForm from '../components/BulkBacktestForm'
import BulkBacktestSummary from '../components/BulkBacktestSummary'
import ErrorBoundary from '../components/ErrorBoundary'

export default function Backtest() {
  const [showForm, setShowForm] = useState(false)
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [bulkSummaryJobId, setBulkSummaryJobId] = useState<string | null>(null)

  const handleViewResults = (jobId: string) => {
    setSelectedJobId(jobId)
  }

  const handleViewBulkSummary = (jobId: string) => {
    setBulkSummaryJobId(jobId)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Backtest</h1>
          <p className="text-muted-foreground mt-2">
            Run backtests on your strategies and analyze results
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkForm(true)}
            className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors flex items-center gap-2"
          >
            <Layers className="h-4 w-4" />
            Bulk Test
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            New Backtest
          </button>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-3">Backtest Jobs</h2>
        <BacktestJobList
          onViewResults={handleViewResults}
          onViewBulkSummary={handleViewBulkSummary}
        />
      </div>

      {bulkSummaryJobId && (
        <BulkBacktestSummary
          jobId={bulkSummaryJobId}
          onClose={() => setBulkSummaryJobId(null)}
          onViewChildResult={handleViewResults}
        />
      )}

      {showForm && (
        <ErrorBoundary>
          <BacktestForm
            onClose={() => setShowForm(false)}
            onSubmitSuccess={(jobId) => {
              console.log('Backtest submitted:', jobId)
            }}
          />
        </ErrorBoundary>
      )}

      {showBulkForm && (
        <ErrorBoundary>
          <BulkBacktestForm
            onClose={() => setShowBulkForm(false)}
            onSubmitSuccess={(jobId) => {
              console.log('Bulk backtest submitted:', jobId)
            }}
          />
        </ErrorBoundary>
      )}

      {selectedJobId && (
        <BacktestResults
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
        />
      )}
    </div>
  )
}
