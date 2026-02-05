import {
    BarChart3,
    Briefcase,
    Database,
    FileCode,
    LayoutDashboard,
    LogOut,
    Menu,
    TrendingUp,
} from 'lucide-react'
import { useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarPinned, setSidebarPinned] = useState(true)
  const [showHeader, setShowHeader] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Strategies', href: '/strategies', icon: FileCode },
    { name: 'Backtest', href: '/backtest', icon: TrendingUp },
    { name: 'Market Data', href: '/market-data', icon: Database },
    { name: 'Portfolio', href: '/portfolio', icon: Briefcase },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      {!sidebarPinned && (
        <div
          onMouseEnter={() => setSidebarOpen(true)}
          onMouseLeave={() => { if (!sidebarPinned) setSidebarOpen(false) }}
          className="fixed left-0 top-0 h-full z-40 w-6 bg-transparent hover:bg-gray-100/10 cursor-pointer"
          aria-hidden={false}
        />
      )}

      <aside
        onMouseEnter={() => setSidebarOpen(true)}
        onMouseLeave={() => { if (!sidebarPinned) setSidebarOpen(false) }}
        className={`fixed inset-y-0 left-0 z-50 bg-card border-r border-border transform transition-transform duration-300 overflow-hidden ${
          sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full w-0'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-border">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const newPinned = !sidebarPinned
                setSidebarPinned(newPinned)
                setSidebarOpen(newPinned)
              }}
              className="p-2 rounded-md hover:bg-accent"
              aria-label="Toggle sidebar"
              aria-pressed={sidebarPinned}
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-bold text-foreground">TraderMate</h1>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="flex-1">
              <p className="text-sm font-medium">{user?.username}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleLogout}
                className="p-2 rounded-md hover:bg-destructive hover:text-destructive-foreground transition-colors"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:pl-64' : ''}`}>
        {/* Header (hidden by default) */}
        {showHeader && (
          <header className="h-16 border-b border-border bg-card flex items-center px-6">
            <div className="flex-1" />
          </header>
        )}

        {/* Page content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
