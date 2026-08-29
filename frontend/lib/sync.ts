import { api } from './api'
import { getPendingUpdates, removeUpdate } from './offline-db'

export async function syncPendingUpdates(
  onProgress?: (current: number, total: number) => void
): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingUpdates()
  let synced = 0
  let failed = 0
  
  for (let i = 0; i < pending.length; i++) {
    const item = pending[i]
    onProgress?.(i, pending.length)
    try {
      await api.updateStock(item.payload)
      if (item.id !== undefined) {
        await removeUpdate(item.id)
      }
      synced++
    } catch {
      failed++
    }
  }
  
  return { synced, failed }
}

export function setupOnlineListener(callback: () => void): () => void {
  window.addEventListener('online', callback)
  return () => window.removeEventListener('online', callback)
}
