/**
 * A tiny local snapshot of what the user has done in the app, kept in
 * localStorage so the personalized error fallback can reassure them
 * with their own facts ("your work is safe") even when a page or the
 * network is down. Written by the dashboard and the invoice create
 * flow; read only by ErrorFallback. Never holds money truth, the
 * server remains the source of record.
 */
export interface ActivitySnapshot {
  shopName?: string
  todayBills?: number
  todayTotal?: number
  lastInvoiceNumber?: string
  lastCustomerName?: string
  updatedAt: string
}

const KEY = 'billdost-activity-snapshot'

export function saveActivitySnapshot(patch: Partial<Omit<ActivitySnapshot, 'updatedAt'>>): void {
  try {
    const existing = readActivitySnapshot()
    const next: ActivitySnapshot = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage unavailable (private mode, quota): the fallback simply
    // shows its generic warm recap instead.
  }
}

export function readActivitySnapshot(): ActivitySnapshot | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ActivitySnapshot
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}
