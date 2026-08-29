import Dexie, { type Table } from 'dexie'
import type { QueuedUpdate } from './types'

export class VitalsDB extends Dexie {
  updates!: Table<QueuedUpdate, number>
  
  constructor() {
    super('vitals-offline')
    this.version(1).stores({
      updates: '++id, queuedAt, retries'
    })
  }
}

export const db = new VitalsDB()

export async function queueUpdate(payload: QueuedUpdate['payload']): Promise<number> {
  return db.updates.add({ payload, queuedAt: Date.now(), retries: 0 })
}

export async function getPendingUpdates(): Promise<QueuedUpdate[]> {
  return db.updates.toArray()
}

export async function removeUpdate(id: number): Promise<void> {
  return db.updates.delete(id)
}

export async function getPendingCount(): Promise<number> {
  return db.updates.count()
}
