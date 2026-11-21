import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveActivitySnapshot, readActivitySnapshot } from '../activity-snapshot'

function installLocalStorage() {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  })
}

describe('activity snapshot', () => {
  beforeEach(() => {
    installLocalStorage()
  })

  it('returns null when nothing was saved', () => {
    expect(readActivitySnapshot()).toBeNull()
  })

  it('round-trips a saved snapshot with a timestamp', () => {
    saveActivitySnapshot({ shopName: 'Sharma Store', todayBills: 3, todayTotal: 1250 })
    const snap = readActivitySnapshot()
    expect(snap?.shopName).toBe('Sharma Store')
    expect(snap?.todayBills).toBe(3)
    expect(snap?.todayTotal).toBe(1250)
    expect(typeof snap?.updatedAt).toBe('string')
  })

  it('merges patches without dropping earlier facts', () => {
    saveActivitySnapshot({ shopName: 'Sharma Store', todayBills: 3 })
    saveActivitySnapshot({ lastInvoiceNumber: 'INV-1042' })
    const snap = readActivitySnapshot()
    expect(snap?.shopName).toBe('Sharma Store')
    expect(snap?.todayBills).toBe(3)
    expect(snap?.lastInvoiceNumber).toBe('INV-1042')
  })

  it('survives corrupt stored JSON', () => {
    localStorage.setItem('billdost-activity-snapshot', '{not json')
    expect(readActivitySnapshot()).toBeNull()
  })
})
