'use client'

import { useEffect, useRef, useState } from 'react'
import type { BloodBank, StatsResponse } from '@/lib/types'
import { formatLiveRelativeTime, parseUTCDate } from '@/lib/time'

interface CoverageMapProps {
  banks: BloodBank[]
  stats: StatsResponse | null
  isLoading: boolean
}

export function CoverageMap({ banks, stats, isLoading }: CoverageMapProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted || isLoading) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl h-[420px] flex items-center justify-center">
        <div className="text-slate-400 text-xs flex items-center gap-2">
          <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-light-navy rounded-full animate-spin" />
          Loading geographic coverage telemetry…
        </div>
      </div>
    )
  }

  return <LeafletMapInner banks={banks} key="coverage-map-light" />
}

function LeafletMapInner({ banks }: { banks: BloodBank[] }) {
  const mapRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    let isCancelled = false

    async function initMap() {
      const leaflet = await import('leaflet')
      await import('leaflet/dist/leaflet.css')
      const L = leaflet.default

      if (!containerRef.current || isCancelled) return

      if (!mapRef.current) {
        if ((containerRef.current as any)._leaflet_id) {
          (containerRef.current as any)._leaflet_id = null
        }

        const map = L.map(containerRef.current, {
          center: [20.5937, 78.9629],
          zoom: 5,
          scrollWheelZoom: false,
          zoomControl: true,
        })

        mapRef.current = map

        // OpenStreetMap Standard Clean Light Tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 18,
        }).addTo(map)
      }

      const map = mapRef.current
      if (!map) return

      // Clear previous circle markers
      map.eachLayer((layer: any) => {
        if (layer instanceof L.CircleMarker) {
          map.removeLayer(layer)
        }
      })

      banks.forEach((bank) => {
        if (!bank.latitude || !bank.longitude) return

        let dateObj: Date | null = null
        if (bank.last_updated) {
          dateObj = parseUTCDate(bank.last_updated)
        }

        const isActive = bank.is_active !== undefined
          ? bank.is_active
          : (dateObj ? dateObj.getTime() > Date.now() - 24 * 60 * 60 * 1000 : false)

        const timeAgo = dateObj && !isNaN(dateObj.getTime())
          ? formatLiveRelativeTime(dateObj)
          : 'Never reported'

        const actualClockTime = dateObj && !isNaN(dateObj.getTime())
          ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : null

        L.circleMarker([bank.latitude, bank.longitude], {
          radius: 6.5,
          color: isActive ? '#16A34A' : '#DC2626',
          fillColor: isActive ? '#16A34A' : '#DC2626',
          fillOpacity: 0.9,
          weight: 1.5,
        })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:sans-serif;font-size:12px;line-height:1.5">
              <strong style="color:#0B1F3A">${bank.name}</strong><br/>
              <span style="color:#6B7280">${bank.city || ''}, ${bank.state || ''}</span><br/>
              <span style="color:${isActive ? '#16A34A' : '#DC2626'};font-weight:700">
                ${isActive ? '● Active (Reporting)' : '● Silent (>24h stale)'}
              </span><br/>
              <span style="color:#6B7280;font-size:11px">
                Last update: ${timeAgo}${actualClockTime ? ` (${actualClockTime})` : ''}
              </span>
            </div>`
          )
      })
    }

    initMap()

    return () => {
      isCancelled = true
    }
  }, [banks])

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-xs relative">
      <div ref={containerRef} style={{ height: '420px', width: '100%' }} />
      {/* Floating Light Legend */}
      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-lg px-3 py-2 z-[1000] flex items-center gap-3.5 shadow-sm">
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
          Active (&lt;24h)
        </span>
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <span className="w-2.5 h-2.5 rounded-full bg-light-accent inline-block" />
          Silent (&gt;24h)
        </span>
      </div>
    </div>
  )
}
