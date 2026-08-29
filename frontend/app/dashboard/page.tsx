'use client'

import { useEffect, useState } from 'react'
import { ImpactMetrics } from '@/components/dashboard/ImpactMetrics'
import { CoverageMap } from '@/components/dashboard/CoverageMap'
import { api } from '@/lib/api'
import type { StatsResponse, BloodBank, RegionCoverage, ActivityEvent } from '@/lib/types'
import { formatLiveRelativeTime, parseUTCDate, useLiveTicker } from '@/lib/time'

function EventLog({ events, isLoading }: { events: ActivityEvent[], isLoading: boolean }) {
  const currentTick = useLiveTicker(2000)
  const formatEventTime = (createdStr?: string | null) => {
    if (!createdStr) return { actual: 'Just now', relative: 'just now' }
    const date = parseUTCDate(createdStr)
    const actual = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const relative = formatLiveRelativeTime(date, currentTick)
    return { actual, relative }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
        <div>
          <h3 className="text-sm font-bold text-light-navy">Recent Reporting Activity</h3>
          <p className="text-xs text-slate-400">Live feed of all Web PWA &amp; SMS webhook submissions</p>
        </div>
        <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
          ● Live Stream ({events.length})
        </span>
      </div>
      <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
        {isLoading ? (
          <div className="p-5 text-slate-400 text-xs">Loading activity feed…</div>
        ) : events.length > 0 ? (
          events.map((ev) => {
            const { actual, relative } = formatEventTime(ev.created_at)
            return (
              <div key={ev.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-slate-50/70 transition-colors">
                <span
                  className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    ev.source === 'sms' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
                <div className="min-w-0 flex-grow">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-bold text-light-navy truncate">{ev.bank_name}</p>
                    <span
                      className={`text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded ${
                        ev.source === 'sms'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {ev.source === 'sms' ? 'SMS Gateway' : 'Web PWA'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Updated <span className="font-bold text-light-navy">{ev.blood_group}</span> ({ev.component}) →{' '}
                    <span className="font-bold text-light-navy">{ev.units} units</span>
                    {ev.city ? ` · ${ev.city}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-auto whitespace-nowrap pl-2">
                  <p className="text-xs font-mono font-bold text-light-navy">{actual}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{relative}</p>
                </div>
              </div>
            )
          })
        ) : (
          <div className="p-6 text-center text-xs text-slate-400">
            No recent updates logged yet. Submit via PWA or SMS simulator on /report to see live events.
          </div>
        )}
      </div>
    </div>
  )
}

function CoverageChart({ regions }: { regions: RegionCoverage[] }) {
  const sortedRegions = [...regions].sort((a, b) => b.coverage_pct - a.coverage_pct)
  const topRegions = sortedRegions.slice(0, 6)

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-light-navy">Regional Coverage Impact</h3>
          <p className="text-xs text-slate-400">Live reporting percentage across states ({regions.length} regions)</p>
        </div>
        <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
          ● State Telemetry
        </span>
      </div>
      <div className="px-5 py-5 space-y-3.5 max-h-[300px] overflow-y-auto">
        {topRegions.length > 0 ? (
          topRegions.map((r) => (
            <div key={r.state} className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-700">{r.state} ({r.reporting_today}/{r.total_banks} centres)</span>
                <span className={`font-bold ${r.coverage_pct >= 70 ? 'text-emerald-600' : r.coverage_pct >= 40 ? 'text-amber-600' : 'text-light-accent'}`}>
                  {r.coverage_pct.toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                <div
                  className={`h-2.5 rounded-full transition-all duration-700 ${
                    r.coverage_pct >= 70 ? 'bg-emerald-500' : r.coverage_pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, r.coverage_pct))}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-xs text-slate-400">Loading regional metrics…</div>
        )}
      </div>
    </div>
  )
}

import { useRouter } from 'next/navigation'
import { getStoredAdminToken, removeStoredAdminToken } from '@/lib/api'

export default function DashboardPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [banks, setBanks] = useState<BloodBank[]>([])
  const [regions, setRegions] = useState<RegionCoverage[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFlagging, setIsFlagging] = useState(false)
  const [flagFeedback, setFlagFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    const token = getStoredAdminToken()
    if (!token) {
      router.replace('/dashboard/login')
      return
    }
    setIsAuthenticated(true)
  }, [router])

  const loadData = async () => {
    const token = getStoredAdminToken()
    if (!token) {
      router.replace('/dashboard/login')
      return
    }

    try {
      const [statsData, banksData, coverageData, activityData] = await Promise.all([
        api.getStats(),
        api.bloodBanks(),
        api.getCoverage(),
        api.getActivity(50).catch(() => []),
      ])
      setStats(statsData)
      setBanks(banksData)
      setRegions(coverageData.regions)
      setActivity(activityData)
    } catch (err: any) {
      if (
        err?.message?.includes('401') || 
        err?.message?.includes('token') || 
        err?.message?.toLowerCase().includes('unauthorized')
      ) {
        removeStoredAdminToken()
        router.replace('/dashboard/login')
        return
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleNotifySilentBanks = async () => {
    setIsFlagging(true)
    setFlagFeedback(null)
    try {
      const res = await api.flagSilentBanks()
      setFlagFeedback({
        type: 'success',
        message: `Flagged ${res.flagged} silent centre(s) for notification (${res.already_pending} already pending).`
      })
      await loadData()
    } catch (err: any) {
      setFlagFeedback({
        type: 'error',
        message: err.message || 'Failed to notify silent banks.'
      })
    } finally {
      setIsFlagging(false)
      setTimeout(() => {
        setFlagFeedback((curr) => (curr?.type === 'success' ? null : curr))
      }, 6000)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      loadData()
      const interval = setInterval(loadData, 5000)
      return () => clearInterval(interval)
    }
  }, [isAuthenticated])

  if (isAuthenticated === null || !isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center p-6 bg-[#F8FAFC]">
        <div className="text-center space-y-3">
          <span className="inline-block w-6 h-6 border-2 border-light-navy/30 border-t-light-navy rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Verifying Admin Authentication…
          </p>
        </div>
      </div>
    )
  }

  const silentBanks = banks.filter((b) => b.is_active === false)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Admin Central</p>
          <h1 className="text-2xl font-black text-light-navy tracking-tight">Impact &amp; Supply Dashboard</h1>
        </div>
        {stats && (
          <div className="sm:text-right">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Telemetry timestamp</p>
            <p className="text-xs font-bold text-light-navy font-mono">
              {stats.last_updated ? formatLiveRelativeTime(stats.last_updated) : 'Real-time'}
            </p>
          </div>
        )}
      </div>

      {/* KPI Cards Row */}
      <ImpactMetrics stats={stats} isLoading={isLoading} />

      {/* Map + Stale Banks Section */}
      <div className="space-y-3">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Geographic Telemetry &amp; Silence Alerts</p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Map */}
          <div className="lg:col-span-2 space-y-3">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
              <CoverageMap banks={banks} stats={stats} isLoading={isLoading} />
            </div>
            {/* Regional Coverage Impact */}
            <CoverageChart regions={regions} />
          </div>

          {/* Stale Banks Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-light-navy">Silent Banks</h3>
                  <span className="text-[10px] font-mono font-bold bg-red-50 text-light-accent px-2 py-0.5 rounded border border-red-200">
                    {silentBanks.length} Silent
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">No reporting updates in &gt;24h</p>
              </div>
              <button
                type="button"
                onClick={handleNotifySilentBanks}
                disabled={isFlagging || silentBanks.length === 0}
                className="inline-flex items-center justify-center gap-1.5 bg-light-accent hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 active:scale-95 shrink-0 btn-interactive"
              >
                {isFlagging ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Notifying…</span>
                  </>
                ) : (
                  <>
                    <span>🔔</span>
                    <span>Notify Silent Banks</span>
                  </>
                )}
              </button>
            </div>

            {flagFeedback && (
              <div className={`px-4 py-2.5 text-xs font-medium border-b flex items-center gap-2 animate-fadeIn ${
                flagFeedback.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                  : 'bg-red-50 text-light-accent border-red-200'
              }`}>
                <span>{flagFeedback.type === 'success' ? '✓' : '⚠'}</span>
                <span>{flagFeedback.message}</span>
              </div>
            )}

            <div className="flex-grow overflow-auto divide-y divide-slate-100 max-h-[420px]">
              {isLoading ? (
                <div className="p-5 text-slate-400 text-xs">Loading telemetry…</div>
              ) : silentBanks.length > 0 ? (
                silentBanks.map((bank) => (
                  <div key={bank.id} className="px-4 py-3 flex items-center justify-between gap-2.5 hover:bg-slate-50/70 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-light-accent shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-light-navy truncate">{bank.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{bank.city}, {bank.state}</p>
                      </div>
                    </div>
                    <div>
                      {bank.silent_alert_status === 'pending' ? (
                        <span className="text-[10px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200 shrink-0 inline-flex items-center gap-1">
                          <span>🔔</span>
                          <span>Notified, awaiting response</span>
                        </span>
                      ) : bank.silent_alert_status === 'acknowledged' ? (
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 shrink-0 inline-flex items-center gap-1">
                          <span>✓</span>
                          <span>Acknowledged</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                          Unnotified
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center h-full space-y-2">
                  <span className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-base">
                    ✓
                  </span>
                  <p className="font-bold text-light-navy text-sm">0 Silent Banks</p>
                  <p className="text-slate-400 max-w-[200px]">All blood centres are active and reporting regularly.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live Activity Event Log */}
      <div>
        <EventLog events={activity} isLoading={isLoading} />
      </div>
    </div>
  )
}
