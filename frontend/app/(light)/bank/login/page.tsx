'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, setStoredBankSession } from '@/lib/api'

export default function BankLoginPage() {
  const router = useRouter()
  const [bankIdentifier, setBankIdentifier] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bankIdentifier.trim()) return

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await api.bankLogin({
        bank_identifier: bankIdentifier.trim(),
      })

      if (response.token) {
        setStoredBankSession(response)
        router.replace('/bank/portal')
      } else {
        setErrorMessage('Identification failed: No token received')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid identifier')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center p-6 bg-light-bg">
      <div className="w-full max-w-md bg-white border border-light-border rounded-2xl shadow-sm p-8 space-y-6 animate-scaleIn">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-red-50 text-light-accent border border-red-200 rounded-xl flex items-center justify-center mx-auto shadow-xs">
            <span className="text-2xl leading-none">🏥</span>
          </div>
          <h1 className="text-xl font-black text-light-navy tracking-tight uppercase">Blood Centre Portal</h1>
          <p className="text-xs text-light-muted max-w-xs mx-auto">
            Emergency Bank-to-Bank Network. Enter your registered Blood Centre Identifier to access logistics &amp; transfers.
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
              Blood Centre ID
            </label>
            <input
              type="text"
              value={bankIdentifier}
              onChange={(e) => setBankIdentifier(e.target.value)}
              placeholder="e.g. BB007 or BB-007"
              required
              autoFocus
              className="w-full border border-slate-300 rounded-xl px-3.5 py-3 text-sm font-mono font-bold bg-white text-slate-900 focus:outline-none focus:border-light-navy focus:ring-2 focus:ring-light-navy/20 transition-all uppercase"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Tip: Use your assigned Centre ID (case and hyphens are normalized automatically).
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading || !bankIdentifier.trim()}
            className="w-full bg-light-accent hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs tracking-widest uppercase py-3.5 rounded-xl shadow-md hover:shadow-xl active:scale-98 transition-all duration-200 flex items-center justify-center gap-2 btn-interactive"
          >
            {isLoading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>Verifying Centre ID…</span>
              </>
            ) : (
              <span>Access Bank Portal →</span>
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
