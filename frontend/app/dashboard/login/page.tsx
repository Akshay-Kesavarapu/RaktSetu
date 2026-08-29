'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, setStoredAdminToken } from '@/lib/api'

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await api.adminLogin({
        username: username.trim(),
        password: password.trim(),
      })

      if (response.token) {
        setStoredAdminToken(response.token)
        router.replace('/dashboard')
      } else {
        setErrorMessage('Authentication failed: Missing token in response')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid username or password')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center p-6 bg-[#F8FAFC]">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-8 space-y-6 animate-scaleIn">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-light-navy text-white rounded-xl flex items-center justify-center mx-auto shadow-xs">
            <span className="text-light-accent text-xl font-bold animate-pulse">●</span>
          </div>
          <h1 className="text-xl font-black text-light-navy tracking-tight">ADMIN ACCESS PORTAL</h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Authorized health officials and logistics coordinators only. Enter your administrator credentials.
          </p>
        </div>

        {errorMessage && (
          <div className="bg-red-50 border border-light-accent/30 rounded-xl p-3.5 text-xs text-light-accent flex items-start gap-2 animate-fadeIn">
            <span className="font-bold">⚠</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Akshay"
              required
              autoFocus
              className="w-full border border-slate-300 rounded-xl px-3.5 py-3 text-sm bg-white text-slate-900 font-medium focus:outline-none focus:border-light-navy focus:ring-2 focus:ring-light-navy/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full border border-slate-300 rounded-xl px-3.5 py-3 text-sm bg-white text-slate-900 font-medium focus:outline-none focus:border-light-navy focus:ring-2 focus:ring-light-navy/20 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !username.trim() || !password.trim()}
            className="w-full bg-light-navy hover:bg-slate-900 disabled:opacity-50 text-white font-bold text-xs tracking-widest uppercase py-3.5 rounded-xl shadow-md hover:shadow-xl active:scale-98 transition-all duration-200 flex items-center justify-center gap-2 btn-interactive"
          >
            {isLoading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>Authenticating…</span>
              </>
            ) : (
              <span>Sign In to Dashboard →</span>
            )}
          </button>
        </form>

        <div className="pt-2 text-center border-t border-slate-100">
          <Link
            href="/"
            className="text-xs font-bold text-slate-400 hover:text-light-navy transition-colors"
          >
            ← Return to Public Homepage
          </Link>
        </div>
      </div>
    </div>
  )
}
