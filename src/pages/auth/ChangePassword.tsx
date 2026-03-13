import { useMutation } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../../lib/api'
import { useAuthStore } from '../../stores/auth'

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()
  const { isAuthenticated, setAuth, logout } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const mutation = useMutation({
    mutationFn: () => authAPI.changePassword(currentPassword, newPassword),
    onSuccess: async () => {
      setError('')
      setSuccess('Password updated successfully.')
      sessionStorage.removeItem('force_change_password')

      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) {
        logout()
        navigate('/login', { replace: true })
        return
      }

      try {
        const refreshResp = await authAPI.refresh(refreshToken)
        const newAccess = refreshResp.data.access_token
        const newRefresh = refreshResp.data.refresh_token
        localStorage.setItem('access_token', newAccess)
        localStorage.setItem('refresh_token', newRefresh)
        const meResp = await authAPI.me()
        setAuth(meResp.data, newAccess, newRefresh)
      } catch (err) {
        logout()
        navigate('/login', { replace: true })
        return
      }

      const redirect = sessionStorage.getItem('post_change_redirect')
      sessionStorage.removeItem('post_change_redirect')
      const target = redirect && !redirect.startsWith('/change-password') ? redirect : '/dashboard'
      navigate(target, { replace: true })
    },
    onError: (err: unknown) => {
      const apiError = err as { response?: { data?: { detail?: string } } }
      setError(apiError.response?.data?.detail || 'Failed to update password')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match')
      return
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters')
      return
    }
    mutation.mutate()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card p-8 rounded-lg shadow-lg border border-border">
          <div className="flex items-center justify-center mb-6">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center mb-2">Change Password</h1>
          <p className="text-muted-foreground text-center mb-6">
            You must update your password before continuing.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 text-sm">
                {success}
              </div>
            )}

            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium mb-2">
                Current Password
              </label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium mb-2">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {mutation.isPending ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
