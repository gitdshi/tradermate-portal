import { useQuery } from '@tanstack/react-query'
import { Activity, AlertCircle, Clock, TrendingUp } from 'lucide-react'
import { queueAPI, systemAPI } from '../lib/api'

export default function Dashboard() {
  const { data: queueStats } = useQuery({
    queryKey: ['queueStats'],
    queryFn: () => queueAPI.getStats(),
    refetchInterval: 5000,
  })

  const { data: syncStatusData } = useQuery({
    queryKey: ['syncStatus'],
    queryFn: () => systemAPI.syncStatus(),
    refetchInterval: 60000,
  })

  const stats = queueStats?.data
  const syncStatus = syncStatusData?.data
  const daemonStatus = syncStatus?.daemon
  const consistency = syncStatus?.consistency
  const latestSync = syncStatus?.sync?.latest || {}

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your trading system status
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Jobs"
          value={stats?.active || 0}
          icon={<Activity className="h-5 w-5" />}
          color="text-blue-500"
          bgColor="bg-blue-500/10"
        />
        <StatCard
          title="Queued Jobs"
          value={stats?.queued || 0}
          icon={<Clock className="h-5 w-5" />}
          color="text-yellow-500"
          bgColor="bg-yellow-500/10"
        />
        <StatCard
          title="Completed"
          value={stats?.completed || 0}
          icon={<TrendingUp className="h-5 w-5" />}
          color="text-green-500"
          bgColor="bg-green-500/10"
        />
        <StatCard
          title="Failed"
          value={stats?.failed || 0}
          icon={<AlertCircle className="h-5 w-5" />}
          color="text-red-500"
          bgColor="bg-red-500/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-lg border border-border">
          <h2 className="text-xl font-semibold mb-4">Queue Status</h2>
          {stats ? (
            <div className="space-y-3">
              {Object.entries(stats.by_queue || {}).map(([queueName, count]) => (
                <div key={queueName} className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">{queueName}</span>
                  <span className="text-sm text-muted-foreground">{String(count)} jobs</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Loading queue status...</p>
          )}
        </div>

        <div className="bg-card p-6 rounded-lg border border-border">
          <h2 className="text-xl font-semibold mb-4">System Status</h2>
          <div className="space-y-3">
            <StatusItem
              label="Backend API"
              status="online"
            />
            <StatusItem
              label="Redis Queue"
              status={stats ? 'online' : 'checking'}
            />
            <StatusItem
              label="Workers"
              status={stats && stats.active > 0 ? 'online' : 'idle'}
            />
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border">
          <h2 className="text-xl font-semibold mb-4">Data Sync Status</h2>
          <div className="space-y-3">
            <StatusItem
              label="Daemon"
              status={daemonStatus?.status || 'checking'}
            />
            <StatusItem
              label="Consistency"
              status={consistency ? (consistency.is_consistent ? 'online' : 'warning') : 'checking'}
            />
            <div className="text-sm text-muted-foreground">
              Missing dates: <span className="font-medium text-foreground">{consistency?.missing_count ?? '—'}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Last run: <span className="font-medium text-foreground">{daemonStatus?.last_run_at ? new Date(daemonStatus.last_run_at).toLocaleString() : '—'}</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <div className="text-sm font-medium mb-2">Latest Sync</div>
            <div className="space-y-2">
              {Object.entries(latestSync).map(([endpoint, info]) => (
                <div key={endpoint} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{endpoint.replace(/_/g, ' ')}</span>
                  <span className="font-medium">{(info as { status?: string }).status || 'unknown'}</span>
                </div>
              ))}
              {Object.keys(latestSync).length === 0 && (
                <div className="text-sm text-muted-foreground">No sync history available</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, color, bgColor }: {
  title: string
  value: number
  icon: React.ReactNode
  color: string
  bgColor: string
}) {
  return (
    <div className="bg-card p-6 rounded-lg border border-border">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${bgColor}`}>
          <div className={color}>{icon}</div>
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground mt-1">{title}</p>
      </div>
    </div>
  )
}

function StatusItem({ label, status }: { label: string; status: string }) {
  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-red-500',
    idle: 'bg-yellow-500',
    checking: 'bg-gray-500',
    warning: 'bg-yellow-500',
    stale: 'bg-red-500',
  }

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${statusColors[status as keyof typeof statusColors]}`} />
        <span className="text-sm text-muted-foreground capitalize">{status}</span>
      </div>
    </div>
  )
}
