'use client'

import { formatLiveRelativeTime, useLiveTicker } from '@/lib/time'
import type { SearchResult } from '@/lib/types'
import { LoadingState } from '@/components/shared/LoadingState'

interface BloodBankResultsProps {
  results: SearchResult[]
  isLoading: boolean
  disclaimer: string
}

function StockBadge({ units }: { units: number }) {
  if (units === 0)
    return <span className="text-[11px] font-black text-light-accent bg-red-50 px-1.5 py-0.5 rounded border border-red-100">{units} u</span>
  if (units <= 10)
    return <span className="text-[11px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">{units} u</span>
  return <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">{units} u</span>
}

export function BloodBankResults({ results, isLoading, disclaimer }: BloodBankResultsProps) {
  const currentTick = useLiveTicker(5000)

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <LoadingState rows={4} />
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="p-12 text-center space-y-3">
        <div className="text-3xl">🔍</div>
        <h3 className="font-bold text-light-navy text-base">No blood centres found nearby</h3>
        <p className="text-slate-500 text-xs max-w-sm mx-auto">
          Try expanding your search radius (e.g. 50 km or 100 km) or selecting a different blood group.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-slate-200">
      {/* Results Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-50/70">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-md border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            Verified Centres ({results.length})
          </span>
        </div>
        {results[0]?.last_updated && (
          <span className="text-[11px] text-slate-500 font-medium">
            Latest update {formatLiveRelativeTime(results[0].last_updated, currentTick)}
          </span>
        )}
      </div>

      {/* Result Cards */}
      <div className="divide-y divide-slate-100">
        {results.map((result) => {
          const totalUnits = result.stock.reduce((sum, s) => sum + s.units, 0)
          return (
            <div key={result.bank.id} className="p-5 hover:bg-slate-50/80 transition-all duration-200 space-y-3 group">
              {/* Card Header: Name + Distance Tag */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-light-navy text-sm group-hover:text-blue-900 transition-colors">{result.bank.name}</h3>
                    {result.bank.bank_ref_code && (
                      <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                        {result.bank.bank_ref_code}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5 truncate">
                    {result.bank.address || `${result.bank.city}, ${result.bank.state}`}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-light-navy bg-slate-100 group-hover:bg-slate-200/80 px-2.5 py-1 rounded-md border border-slate-200 transition-colors">
                    📍 {result.distance_km.toFixed(1)} km
                  </span>
                  {result.last_updated && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      {formatLiveRelativeTime(result.last_updated, currentTick)}
                    </p>
                  )}
                </div>
              </div>

              {/* Stock Badges Row */}
              {result.stock.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {result.stock.map((s) => (
                    <div
                      key={`${s.blood_group}-${s.component}`}
                      className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1 bg-white text-xs shadow-2xs hover:scale-105 transition-transform duration-150"
                    >
                      <span className="font-black text-light-navy">{s.blood_group}</span>
                      <span className="text-slate-400 text-[10px]">({s.component.split(' ')[0]})</span>
                      <StockBadge units={s.units} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="pt-1">
                  <span className="inline-flex items-center text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                    No active stock reported
                  </span>
                </div>
              )}

              {/* Card Footer: Phone + Units Summary */}
              <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
                <span>{result.bank.phone ? `📞 ${result.bank.phone}` : ''}</span>
                <span className="font-semibold text-emerald-700">
                  {totalUnits > 0 ? `${totalUnits} units total` : ''}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Disclaimer Banner */}
      <div className="p-4 bg-amber-50/60 border-t border-amber-200/60 text-xs text-amber-900 flex items-start gap-2">
        <span className="text-sm">⚠</span>
        <p className="leading-relaxed">{disclaimer}</p>
      </div>
    </div>
  )
}
