'use client'

import { useEffect, useRef, useState } from 'react'
import type { SearchResult } from '@/lib/types'

interface SearchMapProps {
  results: SearchResult[]
  userLat?: number
  userLon?: number
  radiusKm?: number
}

export function SearchMap({ results, userLat, userLon, radiusKm }: SearchMapProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl h-[480px] flex items-center justify-center">
        <div className="text-slate-400 text-xs flex items-center gap-2">
          <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-light-navy rounded-full animate-spin" />
          Loading geolocation map…
        </div>
      </div>
    )
  }

  return <LeafletSearchMapInner results={results} userLat={userLat} userLon={userLon} radiusKm={radiusKm} key="search-map" />
}

function LeafletSearchMapInner({ results, userLat, userLon, radiusKm }: SearchMapProps) {
  const mapRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    let isCancelled = false

    async function renderMap() {
      const leaflet = await import('leaflet')
      await import('leaflet/dist/leaflet.css')
      const L = leaflet.default

      if (!containerRef.current || isCancelled) return

      const defaultCenter: [number, number] = userLat && userLon ? [userLat, userLon] : [20.5937, 78.9629]
      const defaultZoom = userLat && userLon ? 9 : 5

      if (!mapRef.current) {
        if ((containerRef.current as any)._leaflet_id) {
          (containerRef.current as any)._leaflet_id = null
        }
        const map = L.map(containerRef.current, {
          center: defaultCenter,
          zoom: defaultZoom,
          scrollWheelZoom: false,
          zoomControl: true,
        })
        mapRef.current = map

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 18,
        }).addTo(map)
      }

      const map = mapRef.current
      if (!map) return

      // Clear existing markers/circles
      map.eachLayer((layer: any) => {
        if (layer instanceof L.Marker || layer instanceof L.CircleMarker || layer instanceof L.Circle) {
          map.removeLayer(layer)
        }
      })

      const bounds: any[] = []

      // User location marker
      if (userLat && userLon) {
        const userLoc: [number, number] = [userLat, userLon]
        bounds.push(userLoc)

        L.circleMarker(userLoc, {
          radius: 8,
          color: '#0B1F3A',
          fillColor: '#0B1F3A',
          fillOpacity: 0.9,
          weight: 2,
        })
          .addTo(map)
          .bindPopup('<strong style="font-size:12px;color:#0B1F3A">📍 Your Search Location</strong>')

        if (radiusKm) {
          L.circle(userLoc, {
            radius: radiusKm * 1000,
            color: '#B3261E',
            fillColor: '#B3261E',
            fillOpacity: 0.05,
            weight: 1,
            dashArray: '4, 4',
          }).addTo(map)
        }
      }

      // Plot real blood bank coordinates returned by API
      results.forEach((r) => {
        const lat = r.bank.latitude
        const lon = r.bank.longitude
        if (!lat || !lon) return

        const bankLoc: [number, number] = [lat, lon]
        bounds.push(bankLoc)

        const totalUnits = r.stock.reduce((sum, s) => sum + s.units, 0)

        L.circleMarker(bankLoc, {
          radius: 7,
          color: '#B3261E',
          fillColor: '#B3261E',
          fillOpacity: 0.85,
          weight: 2,
        })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:sans-serif;font-size:12px;line-height:1.4">
              <strong style="color:#0B1F3A">${r.bank.name}</strong><br/>
              <span style="color:#6B7280">${r.bank.city || ''}, ${r.bank.state || ''}</span><br/>
              <span style="color:#B3261E;font-weight:700">${r.distance_km.toFixed(1)} km away</span><br/>
              <span style="color:#1D8348;font-weight:600">Stock available: ${totalUnits} units</span>
            </div>`
          )
      })

      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [25, 25], maxZoom: 12 })
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 10)
      }
    }

    renderMap()

    return () => {
      isCancelled = true
    }
  }, [results, userLat, userLon, radiusKm])

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
      <div ref={containerRef} style={{ height: '480px', width: '100%' }} />
    </div>
  )
}
