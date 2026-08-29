'use client'

import { useState, useEffect } from 'react'
import { StockReportForm } from '@/components/report/StockReportForm'
import { SMSPipelineSimulator } from '@/components/report/SMSPipelineSimulator'
import { DataDisclosure } from '@/components/shared/DataDisclosure'
import { getPendingCount } from '@/lib/offline-db'

export default function ReportPage() {
  const [activeTab, setActiveTab] = useState<'pwa' | 'sms'>('pwa')
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    async function checkPending() {
      const count = await getPendingCount()
      setPendingCount(count)
    }
    checkPending()
    const interval = setInterval(checkPending, 3000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 1. Left Sidebar Navigation */}
          <aside className="lg:col-span-4 space-y-5">
            {/* Blood Centre Station Identity Card */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-50 text-light-accent flex items-center justify-center font-bold text-lg shrink-0">
                  🏥
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Reporting Station</p>
                  <h2 className="text-sm font-bold text-light-navy truncate">Verified Blood Centre</h2>
                </div>
              </div>

              {/* Status Pills */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                <span className="text-slate-500 font-medium">Connectivity</span>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-bold text-[11px] ${
                  isOnline ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {isOnline ? 'Online Sync' : 'Offline Ready'}
                </span>
              </div>

              {pendingCount > 0 && (
                <div className="flex items-center justify-between text-xs bg-amber-50/80 p-2.5 rounded-lg border border-amber-200/80">
                  <span className="text-amber-800 font-medium">Pending Queue</span>
                  <span className="font-mono font-bold text-amber-900 bg-white px-2 py-0.5 rounded shadow-xs">
                    {pendingCount} updates
                  </span>
                </div>
              )}
            </div>

            {/* Gateway Mode Switcher Nav */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">
                Gateway Method
              </p>
              
              <button
                type="button"
                onClick={() => setActiveTab('pwa')}
                className={`w-full text-left px-3.5 py-3 rounded-lg text-xs font-bold transition-all flex items-center justify-between ${
                  activeTab === 'pwa'
                    ? 'bg-light-navy text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-light-navy'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">📱</span>
                  <div>
                    <p className="font-bold">Report via App</p>
                    <p className={`text-[10px] font-normal ${activeTab === 'pwa' ? 'text-white/70' : 'text-slate-400'}`}>
                      Interactive form · Offline queue
                    </p>
                  </div>
                </div>
                {activeTab === 'pwa' && <span className="text-xs">●</span>}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('sms')}
                className={`w-full text-left px-3.5 py-3 rounded-lg text-xs font-bold transition-all flex items-center justify-between ${
                  activeTab === 'sms'
                    ? 'bg-light-accent text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-light-navy'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">💬</span>
                  <div>
                    <p className="font-bold">Report via SMS</p>
                    <p className={`text-[10px] font-normal ${activeTab === 'sms' ? 'text-white/70' : 'text-slate-400'}`}>
                      Feature phone · zero-data pipeline
                    </p>
                  </div>
                </div>
                {activeTab === 'sms' && <span className="text-xs">●</span>}
              </button>
            </div>

            {/* Offline Resilience Info */}
            <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 space-y-2 text-xs text-blue-900">
              <p className="font-bold flex items-center gap-1.5 text-blue-950">
                <span>⚡</span>
                <span>Automatic Offline Sync</span>
              </p>
              <p className="text-blue-800/80 leading-relaxed text-[11px]">
                Submissions made while disconnected are stored in the browser's local IndexedDB queue and automatically dispatch when connectivity restores.
              </p>
            </div>
          </aside>

          {/* 2. Main Content Area */}
          <main className="lg:col-span-8 space-y-6">
            {/* Top Status Bar */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  Staff Reporting Gateway
                </p>
                <h1 className="text-xl font-black text-light-navy tracking-tight">
                  {activeTab === 'pwa' ? 'Update Blood Stock (PWA)' : 'Simulate SMS Webhook'}
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium hidden sm:inline">Active Mode:</span>
                <span className={`text-xs font-bold font-mono px-2.5 py-1 rounded-md border ${
                  activeTab === 'pwa'
                    ? 'bg-slate-100 text-light-navy border-slate-200'
                    : 'bg-red-50 text-light-accent border-red-200'
                }`}>
                  {activeTab === 'pwa' ? 'GRAPHICAL PWA' : 'TELECOM SMS'}
                </span>
              </div>
            </div>

            {/* Mode Content Card */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-8">
              {activeTab === 'pwa' ? (
                <StockReportForm />
              ) : (
                <SMSPipelineSimulator />
              )}
            </div>
          </main>
        </div>

        <div className="mt-12">
          <DataDisclosure />
        </div>
      </div>
    </div>
  )
}
