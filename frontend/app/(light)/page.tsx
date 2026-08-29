'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { StatsResponse } from '@/lib/types'
import { DataDisclosure } from '@/components/shared/DataDisclosure'

export default function LandingPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadLiveStats() {
      try {
        const data = await api.getPublicStats()
        setStats(data)
      } catch {
        // Fallback gracefully if API unavailable
      } finally {
        setIsLoading(false)
      }
    }
    loadLiveStats()
    const interval = setInterval(loadLiveStats, 10000)
    return () => clearInterval(interval)
  }, [])

  const dynamicStats = [
    {
      label: 'Verified Banks',
      value: stats?.total_banks !== undefined ? String(stats.total_banks) : (isLoading ? '…' : '—'),
      sub: 'in official registry',
    },
    {
      label: 'Units Reported',
      value: stats?.total_units !== undefined ? stats.total_units.toLocaleString() : (isLoading ? '…' : '—'),
      sub: 'units in stock',
    },
    {
      label: 'Active Centres',
      value: stats?.reporting_today !== undefined ? String(stats.reporting_today) : (isLoading ? '…' : '—'),
      sub: 'reporting in <24h',
    },
    {
      label: 'Real Time Sync',
      value: stats?.coverage_pct !== undefined ? `${stats.coverage_pct.toFixed(0)}%` : (isLoading ? '…' : '—'),
      sub: 'regional coverage',
    },
  ]

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)] bg-light-bg">
      {/* 1. Hero Section — Soft Light-Blue Tinted Background */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#E7F1FD] via-[#F1F6FD] to-light-bg pt-20 pb-24 px-6 border-b border-light-border/60">
        {/* Subtle ambient decorative gradient orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-tr from-blue-200/40 via-red-100/30 to-transparent rounded-full blur-3xl pointer-events-none -z-10 animate-float" />
        
        <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10 animate-slideUp">
          <div className="inline-flex items-center gap-2 bg-white/95 backdrop-blur-xs border border-blue-200/80 px-4 py-1.5 rounded-full shadow-xs hover:border-blue-400 transition-colors">
            <span className="w-2 h-2 rounded-full bg-light-accent animate-pulse" />
            <span className="text-light-accent text-xs font-bold uppercase tracking-widest">
              Real-time · Offline-first · SMS-ready
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-light-navy tracking-tight leading-[1.15]">
            EVERY DROP COUNTS.<br />
            <span className="text-light-accent bg-gradient-to-r from-light-accent via-red-600 to-rose-700 bg-clip-text text-transparent">
              EVERY SECOND MATTERS.
            </span>
          </h1>

          <p className="text-light-muted text-base sm:text-lg max-w-2xl mx-auto leading-relaxed font-normal">
            Real-time blood inventory tracking designed for resilience. Offline-first reporting for banks, instant discovery for patients.
          </p>

          {/* Side-by-side Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/report"
              className="w-full sm:w-auto bg-light-accent hover:bg-red-700 text-white font-bold text-xs tracking-widest uppercase px-8 py-3.5 rounded-xl shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-200 text-center flex items-center justify-center gap-2 group btn-interactive"
            >
              <span>REPORT STOCK</span>
              <span className="group-hover:translate-x-1.5 transition-transform duration-200">→</span>
            </Link>
            <Link
              href="/search"
              className="w-full sm:w-auto bg-white hover:bg-slate-50 text-light-navy border border-light-border hover:border-slate-300 font-bold text-xs tracking-widest uppercase px-8 py-3.5 rounded-xl shadow-xs hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-200 text-center btn-interactive"
            >
              SEARCH INVENTORY
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Stat Cards Row — Dynamic Real-Time Backend Data */}
      <section className="px-6 -mt-10 relative z-20">
        <div className="max-w-5xl mx-auto bg-white border border-light-border rounded-2xl shadow-sm hover:shadow-md transition-shadow p-6 grid grid-cols-2 sm:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-light-border text-center">
          {dynamicStats.map((s, idx) => (
            <div key={s.label} className={`group ${idx > 0 ? 'sm:pl-6 pt-4 sm:pt-0' : ''}`}>
              <p className="text-3xl font-black text-light-navy tracking-tight group-hover:scale-105 transition-transform duration-300">
                {s.value}
              </p>
              <p className="text-xs font-semibold text-light-muted mt-1 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Core Capabilities Card Grid */}
      <section className="px-6 py-16 max-w-5xl mx-auto w-full space-y-8">
        <div className="text-center space-y-1.5">
          <p className="text-xs font-bold text-light-accent uppercase tracking-widest">
            Architecture &amp; Logistics
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-light-navy tracking-tight">
            CORE CAPABILITIES
          </h2>
          <p className="text-xs text-light-muted max-w-lg mx-auto">
            Built for extreme resilience across high-bandwidth hospitals and zero-connectivity rural centres.
          </p>
        </div>

        {/* 4-Card Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Large Light Card (The Searcher / Real-Time State) */}
          <div className="bg-white border border-light-border rounded-2xl shadow-sm p-7 flex flex-col justify-between space-y-6 hover:border-blue-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-2xs">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                </svg>
              </div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">The Searcher · Real-Time State</p>
              <h3 className="text-xl font-bold text-light-navy group-hover:text-blue-900 transition-colors">I Need Blood — Instant Discovery</h3>
              <p className="text-light-muted text-sm leading-relaxed">
                Find nearby blood banks with verified inventory. Ensures public search displays real-time verified stock and distance metrics.
              </p>
            </div>
            <div>
              <Link
                href="/search"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-light-navy hover:text-light-accent transition-colors group/link"
              >
                <span>SEARCH INVENTORY</span>
                <span className="group-hover/link:translate-x-1 transition-transform">→</span>
              </Link>
            </div>
          </div>

          {/* Card 2: Contrasting Dark Card (The Reporter / Offline-First Sync) */}
          <div className="bg-light-navy text-white border border-light-navy rounded-2xl shadow-md p-7 flex flex-col justify-between space-y-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-white/10 text-light-accent flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-2xs">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M16 10l-4-4-4 4M12 6v10" />
                </svg>
              </div>
              <p className="text-xs font-bold text-light-accent uppercase tracking-widest">The Reporter · Offline-First</p>
              <h3 className="text-xl font-bold text-white">Update Stock — Zero Downtime</h3>
              <p className="text-white/70 text-sm leading-relaxed">
                Quickly update inventory, works offline too. Updates are saved locally (IndexedDB) and auto-sync to backend when reconnected.
              </p>
            </div>
            <div>
              <Link
                href="/report"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-light-accent hover:underline group/link"
              >
                <span>REPORT STOCK</span>
                <span className="group-hover/link:translate-x-1 transition-transform">→</span>
              </Link>
            </div>
          </div>

          {/* Card 3: SMS Fallback Webhook */}
          <div className="bg-white border border-light-border rounded-2xl shadow-sm p-7 flex flex-col justify-between space-y-6 hover:border-emerald-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-2xs">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Telecom Resilience · SMS Webhook</p>
              <h3 className="text-xl font-bold text-light-navy group-hover:text-emerald-900 transition-colors">Feature Phone Compatibility</h3>
              <p className="text-light-muted text-sm leading-relaxed">
                Allows standard SMS reporting in zero-network areas via telecom webhooks, ensuring rural and remote blood centres never go dark.
              </p>
            </div>
            <div>
              <Link
                href="/report"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-light-navy hover:text-light-accent transition-colors group/link"
              >
                <span>TEST SMS GATEWAY</span>
                <span className="group-hover/link:translate-x-1 transition-transform">→</span>
              </Link>
            </div>
          </div>

          {/* Card 4: Blood Centre Portal / Inter-Bank Transfers */}
          <div className="bg-white border border-light-border rounded-2xl shadow-sm p-7 flex flex-col justify-between space-y-6 hover:border-red-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-red-50 text-light-accent flex items-center justify-center text-2xl font-black group-hover:scale-110 transition-transform duration-300 shadow-2xs">
                🏥
              </div>
              <p className="text-xs font-bold text-light-accent uppercase tracking-widest">Emergency Logistics · Bank-to-Bank Network</p>
              <h3 className="text-xl font-bold text-light-navy group-hover:text-red-950 transition-colors">Blood Centre Portal — Inter-Bank Network</h3>
              <p className="text-light-muted text-sm leading-relaxed">
                Direct emergency blood requisitions and transfers between verified blood centres. Dispatch requisitions, approve incoming transfers, and track delivery status in real time.
              </p>
            </div>
            <div>
              <Link
                href="/bank/portal"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-light-navy hover:text-light-accent transition-colors group/link"
              >
                <span>ACCESS BANK PORTAL</span>
                <span className="group-hover/link:translate-x-1 transition-transform">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-light-navy text-white/60 text-xs px-6 py-6 mt-auto border-t border-light-navy">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-light-accent font-bold text-sm">●</span>
            <span className="font-bold text-white">VITALS</span>
            <span>© {new Date().getFullYear()}. All rights reserved.</span>
          </div>
          <div className="flex gap-5 font-medium">
            <a href="/docs" className="hover:text-white transition-colors">Docs</a>
            <a href="/api/docs" className="hover:text-white transition-colors">API</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>

      <DataDisclosure />
    </div>
  )
}
