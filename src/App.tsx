import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Analytics from './pages/Analytics'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import Backtest from './pages/Backtest'
import Dashboard from './pages/Dashboard'
import MarketData from './pages/MarketData'
import Portfolio from './pages/Portfolio'
import Strategies from './pages/Strategies'
import { useAuthStore } from './stores/auth'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="strategies" element={<Strategies />} />
        <Route path="backtest" element={<Backtest />} />
        <Route path="market-data" element={<MarketData />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="portfolio" element={<Portfolio />} />
      </Route>
    </Routes>
  )
}

export default App
