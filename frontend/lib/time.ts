import { useState, useEffect } from 'react'

/**
 * Parses any ISO date string or timestamp ensuring proper UTC interpretation.
 * If the string lacks a timezone suffix (e.g. "2026-08-27T19:01:12"),
 * it appends 'Z' to prevent browsers from assuming local time.
 */
export function parseUTCDate(dateInput: string | Date | number | null | undefined): Date {
  if (!dateInput) return new Date()
  if (dateInput instanceof Date) return dateInput
  if (typeof dateInput === 'number') return new Date(dateInput)

  let s = String(dateInput).trim()
  if (!s) return new Date()

  // If missing 'T', replace space with 'T' (SQL format: '2026-08-27 19:01:12')
  if (s.includes(' ') && !s.includes('T')) {
    s = s.replace(' ', 'T')
  }

  // If no timezone offset is present at the end, append 'Z' for UTC
  if (!s.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(s) && !/[+-]\d{4}$/.test(s)) {
    s = s + 'Z'
  }

  const d = new Date(s)
  return isNaN(d.getTime()) ? new Date() : d
}

/**
 * Formats a timestamp into a precise, accurate relative time string.
 * Handles freshly created items ("just now", "15s ago") accurately.
 */
export function formatLiveRelativeTime(
  dateInput: string | Date | number | null | undefined,
  referenceTime?: number
): string {
  if (!dateInput) return 'just now'

  const date = parseUTCDate(dateInput)
  const now = referenceTime ?? Date.now()
  const diffMs = now - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)

  // Handle future or instantaneous timestamps safely
  if (diffSec < 10) return 'just now'
  if (diffSec < 60) return `${diffSec} seconds ago`

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin === 1) return '1 minute ago'
  if (diffMin < 60) return `${diffMin} minutes ago`

  const diffHours = Math.floor(diffMin / 60)
  if (diffHours === 1) return '1 hour ago'
  if (diffHours < 24) return `${diffHours} hours ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return '1 day ago'
  if (diffDays < 30) return `${diffDays} days ago`

  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths === 1) return '1 month ago'
  return `${diffMonths} months ago`
}

/**
 * React hook that triggers a state update at a fixed interval (default 1s)
 * enabling live, real-time ticking of all relative timestamp labels.
 */
export function useLiveTicker(intervalMs: number = 1000): number {
  const [tick, setTick] = useState<number>(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(Date.now())
    }, intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return tick
}
