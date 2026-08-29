'use client'

import type { StatsResponse } from '@/lib/types'

interface ImpactMetricsProps {
  stats: StatsResponse | null
  isLoading: boolean
}

const Skeleton = () => (
  <div className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse shadow-sm">
    <div className="h-3 w-24 bg-slate-200 rounded mb-3" />
    <div className="h-9 w-16 bg-slate-200 rounded" />
  </div>
)

export function ImpactMetrics({ stats, isLoading }: ImpactMetricsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Skeleton /><Skeleton /><Skeleton /><Skeleton />
      </div>
    )
  }

  const metrics = [
    {
      label: 'Total Banks Tracked',
      value: stats?.total_banks !== undefined ? stats.total_banks : '—',
      color: 'text-light-navy',
      sub: 'in registry',
      accentBg: 'bg-slate-50',
      icon: '🏥',
    },
    {
      label: 'Reporting Banks',
      value: stats?.reporting_today !== undefined ? stats.reporting_today : '—',
      color: 'text-emerald-600',
      sub: 'active in <24h',
      accentBg: 'bg-emerald-50/50',
      icon: '🟢',
    },
    {
      label: 'Silent Banks',
      value: stats?.stale_banks !== undefined ? stats.stale_banks : '—',
      color: 'text-light-accent',
      sub: 'no report >24h',
      accentBg: 'bg-red-50/50',
      icon: '🔴',
    },
    {
      label: 'Coverage',
      value: stats?.coverage_pct !== undefined ? `${stats.coverage_pct.toFixed(0)}%` : '—',
      color: 'text-blue-600',
      sub: 'active / total',
      accentBg: 'bg-blue-50/50',
      icon: '📊',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{m.label}</p>
            <span className="text-xs">{m.icon}</span>
          </div>
          <p className={`text-4xl font-black ${m.color} leading-none tracking-tight`}>{String(m.value)}</p>
          <p className="text-xs text-slate-400 mt-1.5 font-medium">{m.sub}</p>
        </div>
      ))}
    </div>
  )
}
