import { describe, it, expect } from 'vitest'
import { paginateItems, paginateArray, PAGE_CAPACITY } from '../paginate'

describe('paginateItems', () => {
  it('keeps small bills on one page', () => {
    expect(paginateItems(0)).toEqual([[0, 0]])
    expect(paginateItems(1)).toEqual([[0, 1]])
    expect(paginateItems(PAGE_CAPACITY.single)).toEqual([[0, PAGE_CAPACITY.single]])
  })

  it('splits to two pages when items exceed one page', () => {
    const pages = paginateItems(PAGE_CAPACITY.single + 1)
    expect(pages.length).toBe(2)
    expect(pages[1][1]).toBe(PAGE_CAPACITY.single + 1)
  })

  it('never leaves a 1-item last page on a two-page bill', () => {
    // 17 items: naive split is 16 + 1; balanced split borrows rows.
    const pages = paginateItems(17)
    expect(pages.length).toBe(2)
    const lastSize = pages[1][1] - pages[1][0]
    expect(lastSize).toBeGreaterThanOrEqual(4)
  })

  it('covers every item exactly once, contiguously, for many sizes', () => {
    for (const n of [10, 17, 25, 26, 40, 45, 46, 60, 100, 137]) {
      const pages = paginateItems(n)
      let cursor = 0
      for (const [a, b] of pages) {
        expect(a).toBe(cursor)
        cursor = b
      }
      expect(cursor).toBe(n)
    }
  })

  it('respects page capacities on multi-page bills', () => {
    for (const n of [26, 30, 55, 90, 137]) {
      const pages = paginateItems(n)
      const sizes = pages.map(([a, b]) => b - a)
      expect(sizes[0]).toBeLessThanOrEqual(PAGE_CAPACITY.first)
      for (const s of sizes.slice(1, -1)) {
        expect(s).toBeLessThanOrEqual(PAGE_CAPACITY.middle)
      }
      expect(sizes[sizes.length - 1]).toBeLessThanOrEqual(PAGE_CAPACITY.lastWithTotals)
    }
  })

  it('paginateArray slices correctly', () => {
    const items = Array.from({ length: 30 }, (_, i) => i)
    const pages = paginateArray(items)
    expect(pages.flat()).toEqual(items)
    expect(pages.length).toBe(3)
  })
})
