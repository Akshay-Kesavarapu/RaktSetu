'use client'

import type { SyncStatus as SyncStatusType } from '@/lib/types'

interface SyncStatusProps {
  status: SyncStatusType
  pendingCount: number
  customMessage?: string | null
}

const CONFIG = {
  idle: null,
  syncing: {
    dot: 'bg-light-muted animate-pulse',
    defaultLabel: 'Syncing…',
    text: 'text-light-muted',
  },
  synced: {
    dot: 'bg-light-success',
    defaultLabel: 'Synced successfully',
    text: 'text-light-success',
  },
  queued: {
    dot: 'bg-[#F0883E] animate-pulse',
    defaultLabel: 'Waiting for connection',
    text: 'text-light-muted',
  },
  error: {
    dot: 'bg-light-accent',
    defaultLabel: 'Sync failed. Will retry when online.',
    text: 'text-light-accent',
  },
} as const

export function SyncStatus({ status, pendingCount, customMessage }: SyncStatusProps) {
  const cfg = CONFIG[status]
  if (!cfg) return null

  const label = customMessage || cfg.defaultLabel

  return (
    <div className="flex items-center justify-between text-xs px-1">
      <span className="text-light-muted font-mono">{`<SyncStatus/>`}</span>
      <div className="flex items-center gap-1.5">
        <span className={`inline-block w-2 h-2 rounded-full ${cfg.dot}`} />
        <span className={cfg.text}>
          {label}
          {status === 'queued' && pendingCount > 0 ? ` (${pendingCount} queued in IndexedDB)` : ''}
        </span>
      </div>
    </div>
  )
}
