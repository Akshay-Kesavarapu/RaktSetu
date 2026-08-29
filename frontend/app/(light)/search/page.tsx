'use client'

import { useState } from 'react'
import { SearchFilters } from '@/components/search/SearchFilters'
import { BloodBankResults } from '@/components/search/BloodBankResults'
import { SearchMap } from '@/components/search/SearchMap'
import { DataDisclosure } from '@/components/shared/DataDisclosure'
import { api } from '@/lib/api'
import type { SearchResponse, BloodGroup, BloodComponent } from '@/lib/types'

export default function SearchPage() {
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [lastSearchParams, setLastSearchParams] = useState<{
    lat: number
    lon: number
    radius_km?: number
  } | null>(null)

  const handleSearch = async (params: {
    lat: number
    lon: number
    blood_group?: BloodGroup
    component?: BloodComponent
    radius_km?: number
  }) => {
    setIsLoading(true)
    setSearched(true)
    setLastSearchParams({ lat: params.lat, lon: params.lon, radius_km: params.radius_km })

    try {
      const data = await api.searchStock(params)
      setResults(data)
    } catch {
      setResults({ results: [], total: 0, disclaimer: 'Failed to retrieve search results from backend API.' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8 space-y-6">
        {/* Header Title */}
        <div className="border-b border-slate-200 pb-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Public Search</p>
          <h1 className="text-2xl sm:text-3xl font-black text-light-navy tracking-tight">Find Verified Blood Stock</h1>
          <p className="text-xs text-slate-500 mt-1">
            Search nearby blood banks by location, blood group, and real-time inventory levels.
          </p>
        </div>

        {/* Two-Column Layout: Left = Filters & Results; Right = Interactive Map */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (Filters + Results List) */}
          <div className="lg:col-span-6 xl:col-span-5 space-y-6">
            {/* Search Filters Card */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <SearchFilters onSearch={handleSearch} isLoading={isLoading} />
            </div>

            {/* Results Section */}
            {searched && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <BloodBankResults
                  results={results?.results || []}
                  isLoading={isLoading}
                  disclaimer={results?.disclaimer || ''}
                />
              </div>
            )}
          </div>

          {/* Right Column (Interactive Leaflet Map) */}
          <div className="lg:col-span-6 xl:col-span-7 space-y-3 lg:sticky lg:top-[76px]">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-light-navy">Geolocation Map View</h2>
                  <p className="text-[11px] text-slate-400">Centres within search radius</p>
                </div>
                {results && (
                  <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded border border-slate-200">
                    {results.total} Centres Mapped
                  </span>
                )}
              </div>

              <SearchMap
                results={results?.results || []}
                userLat={lastSearchParams?.lat}
                userLon={lastSearchParams?.lon}
                radiusKm={lastSearchParams?.radius_km}
              />
            </div>
          </div>
        </div>

        <div className="mt-12">
          <DataDisclosure />
        </div>
      </div>
    </div>
  )
}
