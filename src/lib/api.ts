import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem('refresh_token')
        if (refreshToken) {
          const { data } = await axios.post(`${API_URL}/api/auth/refresh`, {
            refresh_token: refreshToken,
          })

          localStorage.setItem('access_token', data.access_token)
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`

          return api(originalRequest)
        }
      } catch (refreshError) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

// Auth API
export const authAPI = {
  login: (username: string, password: string) =>
    api.post('/api/auth/login', { username, password }),
  
  register: (username: string, email: string, password: string) =>
    api.post('/api/auth/register', { username, email, password }),
  
  me: () => api.get('/api/auth/me'),
  
  refresh: (refreshToken: string) =>
    api.post('/api/auth/refresh', { refresh_token: refreshToken }),
}

// Strategies API
export const strategiesAPI = {
  list: () => api.get('/api/strategies'),
  
  get: (id: number) => api.get(`/api/strategies/${id}`),
  
  create: (data: any) => api.post('/api/strategies', data),
  
  update: (id: number, data: any) => api.put(`/api/strategies/${id}`, data),
  
  delete: (id: number) => api.delete(`/api/strategies/${id}`),
  
  listBuiltin: () => api.get('/api/strategies/builtin'),
}

// Backtest API
export const backtestAPI = {
  submit: (data: any) => api.post('/api/backtest', data),
  
  submitBatch: (data: any) => api.post('/api/backtest/batch', data),
  
  getStatus: (jobId: string) => api.get(`/api/backtest/${jobId}`),
  
  getHistory: () => api.get('/api/backtest/history'),
  
  cancel: (jobId: string) => api.post(`/api/backtest/${jobId}/cancel`),
}

// Queue API
export const queueAPI = {
  getStats: () => api.get('/api/queue/stats'),
  stats: () => api.get('/api/queue/stats'),
  
  listJobs: (status?: string, limit?: number) =>
    api.get('/api/queue/jobs', { params: { status, limit } }),
  
  getJob: (jobId: string) => api.get(`/api/queue/jobs/${jobId}`),
  
  cancelJob: (jobId: string) => api.post(`/api/queue/jobs/${jobId}/cancel`),
  
  deleteJob: (jobId: string) => api.delete(`/api/queue/jobs/${jobId}`),
  
  submitBacktest: (data: {
    strategy_id?: number
    strategy_class?: string
    strategy_name?: string
    symbol: string
    symbol_name?: string
    start_date: string
    end_date: string
    initial_capital?: number
    rate?: number
    slippage?: number
    parameters?: Record<string, unknown>
  }) => api.post('/api/queue/backtest', data),
}

// Market Data API
export const marketDataAPI = {
  symbols: (exchange?: string, keyword?: string, limit?: number, offset?: number) =>
    api.get('/api/data/symbols', { params: { exchange, keyword, limit, offset } }),
  
  history: (symbol: string, startDate: string, endDate: string) =>
    api.get('/api/data/history', { params: { symbol, start_date: startDate, end_date: endDate } }),
  
  indicators: (symbol: string, startDate: string, endDate: string) =>
    api.get('/api/data/indicators', { params: { symbol, start_date: startDate, end_date: endDate } }),
  
  overview: () => api.get('/api/data/overview'),
  
  sectors: () => api.get('/api/data/sectors'),
}

// Analytics API
export const analyticsAPI = {
  dashboard: () => api.get('/api/analytics/dashboard'),
  
  riskMetrics: () => api.get('/api/analytics/risk-metrics'),
  
  compare: (ids: string) => api.get('/api/analytics/compare', { params: { ids } }),
}

// Portfolio API
export const portfolioAPI = {
  positions: () => api.get('/api/portfolio/positions'),
  
  closedTrades: () => api.get('/api/portfolio/closed-trades'),
  
  closePosition: (positionId: number) => api.post(`/api/portfolio/positions/${positionId}/close`),
}

// Optimization API
export const optimizationAPI = {
  submit: (data: any) => api.post('/api/optimization', data),
  
  getStatus: (jobId: string) => api.get(`/api/optimization/${jobId}`),
  
  getHistory: () => api.get('/api/optimization/history'),
  
  cancel: (jobId: string) => api.post(`/api/optimization/${jobId}/cancel`),
}

// Strategy Files API
export const strategyFilesAPI = {
  list: (source: 'data' | 'project' | 'both' = 'data') =>
    api.get('/api/strategy-files', { params: { source } }),
  
  get: (name: string, source: 'data' | 'project' = 'data') =>
    api.get(`/api/strategy-files/${name}`, { params: { source } }),
  
  create: (data: { name: string; content: string; source?: string }) =>
    api.post('/api/strategy-files', data),
  
  update: (name: string, data: { content: string; source?: string }) =>
    api.put(`/api/strategy-files/${name}`, data),
  
  delete: (name: string, source: 'data' | 'project' = 'data') =>
    api.delete(`/api/strategy-files/${name}`, { params: { source } }),
  
  sync: (direction: 'bidirectional' | 'data_to_project' | 'project_to_data' = 'bidirectional') =>
    api.post('/api/strategy-files/sync', { direction }),
  
  compare: () =>
    api.get('/api/strategy-files/compare/all'),
  
  // history endpoints
  listHistory: (name: string, source: 'data' | 'project' = 'data') =>
    api.get(`/api/strategy-files/${name}/history`, { params: { source } }),

  getHistoryContent: (name: string, versionName: string, source: 'data' | 'project' = 'data') =>
    api.get(`/api/strategy-files/${name}/history/${versionName}`, { params: { source } }),

  recoverHistory: (name: string, versionName: string, source: 'data' | 'project' = 'data') =>
    api.post(`/api/strategy-files/${name}/history/recover`, { version_name: versionName, source }),
}

// DB-backed strategy file endpoints
export const strategyFilesDbAPI = {
  list: (source: 'data' | 'project' | 'both' = 'data') => api.get('/api/strategy-files/db', { params: { source } }),
  listHistory: (name: string, source: 'data' | 'project' = 'data') => api.get(`/api/strategy-files/db/${name}/history`, { params: { source } }),
  getHistoryContent: (name: string, historyId: number, source: 'data' | 'project' = 'data') => api.get(`/api/strategy-files/db/${name}/history/${historyId}`, { params: { source } }),
}

// Strategy code history API
export const strategyCodeAPI = {
  listCodeHistory: (strategyId: number) => api.get(`/api/strategies/${strategyId}/code-history`),
  getCodeHistory: (strategyId: number, historyId: number) => api.get(`/api/strategies/${strategyId}/code-history/${historyId}`),
  restoreCodeHistory: (strategyId: number, historyId: number) => api.post(`/api/strategies/${strategyId}/code-history/${historyId}/restore`),
}
