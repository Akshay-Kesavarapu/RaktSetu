'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { BloodGroup, BloodComponent } from '@/lib/types'

const BLOOD_GROUPS = ['Any', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const COMPONENTS = ['Any', 'Whole Blood', 'Packed Red Cells', 'Fresh Frozen Plasma', 'Platelets', 'Cryoprecipitate']
const RADIUS_OPTIONS = [
  { label: '10 km', value: '10' },
  { label: '25 km', value: '25' },
  { label: '50 km', value: '50' },
  { label: '100 km', value: '100' },
]

interface SearchFiltersProps {
  onSearch: (params: {
    lat: number
    lon: number
    blood_group?: BloodGroup
    component?: BloodComponent
    radius_km?: number
  }) => void
  isLoading: boolean
}

export function SearchFilters({ onSearch, isLoading }: SearchFiltersProps) {
  const [bloodGroup, setBloodGroup] = useState('Any')
  const [component, setComponent] = useState('Any')
  const [radius, setRadius] = useState('50')
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [locationName, setLocationName] = useState('')
  const [locationError, setLocationError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  // Dynamically initialize location from browser GPS or first registered blood bank
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude.toString())
          setLon(pos.coords.longitude.toString())
          setLocationName('Current Location (GPS)')
        },
        async () => {
          // If GPS denied, dynamically fetch first bank from API
          try {
            const banks = await api.bloodBanks()
            const firstValid = banks.find((b) => b.latitude && b.longitude)
            if (firstValid && firstValid.latitude && firstValid.longitude) {
              setLat(firstValid.latitude.toString())
              setLon(firstValid.longitude.toString())
              setLocationName(firstValid.city ? `${firstValid.city}, ${firstValid.state}` : firstValid.name)
            }
          } catch {
            // Ignore if offline
          }
        }
      )
    }
  }, [])

  const handleLocation = () => {
    setLocationError(null)
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toString())
        setLon(pos.coords.longitude.toString())
        setLocationName('Current Location (GPS)')
        setLocating(false)
      },
      () => {
        setLocationError('Unable to retrieve GPS coordinates. Please enter manually or select a centre.')
        setLocating(false)
      }
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!lat || !lon) {
      setLocationError('Please provide coordinates or use geolocation.')
      return
    }
    onSearch({
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      blood_group: bloodGroup === 'Any' ? undefined : (bloodGroup as BloodGroup),
      component: component === 'Any' ? undefined : (component as BloodComponent),
      radius_km: parseFloat(radius),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 1. Blood Group Grid */}
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2.5">
          Blood Group
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
          {BLOOD_GROUPS.map((bg) => (
            <button
              key={bg}
              type="button"
              onClick={() => setBloodGroup(bg)}
              className={`py-2 rounded-xl text-xs font-black border transition-all duration-150 pill-interactive ${
                bloodGroup === bg
                  ? 'bg-light-accent text-white border-light-accent shadow-xs scale-[1.02]'
                  : 'bg-white text-light-navy border-slate-200 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              {bg}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Component */}
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
          Component
        </label>
        <select
          value={component}
          onChange={(e) => setComponent(e.target.value)}
          className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 text-xs font-medium focus:outline-none focus:border-light-navy focus:ring-2 focus:ring-light-navy/20 transition-all"
        >
          {COMPONENTS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* 3. Search Radius */}
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
          Radius
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {RADIUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRadius(opt.value)}
              className={`text-xs font-bold py-2 rounded-xl border transition-all duration-150 pill-interactive ${
                radius === opt.value
                  ? 'bg-light-navy text-white border-light-navy shadow-xs scale-[1.02]'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Geolocation Picker */}
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
          Search Location
        </label>
        <button
          type="button"
          onClick={handleLocation}
          className="w-full flex items-center justify-between border border-slate-300 rounded-xl px-3.5 py-2.5 bg-white text-slate-700 text-xs hover:border-light-navy hover:bg-slate-50 active:scale-98 transition-all shadow-2xs btn-interactive"
        >
          <div className="flex items-center gap-2 truncate pr-2">
            <span className="text-light-accent font-bold">📍</span>
            <span className="font-semibold truncate">
              {locating ? 'Detecting location…' : locationName ? locationName : lat ? `Lat: ${parseFloat(lat).toFixed(3)}, Lon: ${parseFloat(lon).toFixed(3)}` : 'Click to detect GPS location'}
            </span>
          </div>
          <span className="text-[10px] font-bold text-light-accent bg-red-50 px-2 py-0.5 rounded-full border border-red-200 shrink-0">
            GPS Auto
          </span>
        </button>
        {locationError && (
          <p className="text-[11px] text-light-accent mt-1 animate-fadeIn">{locationError}</p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-light-accent hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs tracking-widest uppercase py-3.5 rounded-xl shadow-md hover:shadow-xl active:scale-98 transition-all duration-200 flex items-center justify-center gap-2 btn-interactive"
      >
        {isLoading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            <span>Searching Inventory…</span>
          </>
        ) : (
          <>
            <span>🔍</span>
            <span>Search Inventory</span>
          </>
        )}
      </button>
    </form>
  )
}
