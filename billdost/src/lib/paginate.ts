/**
 * Splits invoice/quotation line items across A4 pages for the PDF
 * previews. Pure and unit-tested: the preview components render
 * exactly what this returns, one fixed-height A4 div per page, and
 * each page is captured separately into the PDF.
 *
 * Capacity model (rows per page at the preview's row height):
 * - A bill that fits with its totals block stays on ONE page.
 * - Page 1 carries the full shop header and the customer block, so it
 *   holds fewer rows than a continuation page (slim header).
 * - The last page must also fit the totals, notes, QR and terms
 *   block, so it holds fewer rows again.
 * Distribution is balanced: no crammed page next to a nearly empty
 * one, and the last page is never left with a single orphan row when
 * it can borrow from the page before.
 */
export const PAGE_CAPACITY = {
  single: 9,
  first: 16,
  middle: 20,
  lastWithTotals: 9,
} as const

function totalCapacity(pages: number): number {
  if (pages <= 1) return PAGE_CAPACITY.single
  return PAGE_CAPACITY.first + PAGE_CAPACITY.middle * (pages - 2) + PAGE_CAPACITY.lastWithTotals
}

/** Distributes `tail` items across pages with the given caps, evenly,
 *  shifting overflow leftwards when a page exceeds its cap. */
function distributeTail(tail: number, caps: number[]): number[] {
  const k = caps.length
  const sizes = caps.map(() => Math.floor(tail / k))
  let rem = tail - sizes.reduce((a, b) => a + b, 0)
  for (let i = 0; rem > 0; i = (i + 1) % k) {
    sizes[i] += 1
    rem -= 1
  }
  for (let i = k - 1; i >= 0; i--) {
    if (sizes[i] > caps[i]) {
      let overflow = sizes[i] - caps[i]
      sizes[i] = caps[i]
      let j = i - 1
      while (overflow > 0 && j >= 0) {
        const room = caps[j] - sizes[j]
        const add = Math.min(room, overflow)
        sizes[j] += add
        overflow -= add
        j -= 1
      }
    }
  }
  return sizes
}

/**
 * Returns an array of [start, end) index ranges, one per page.
 * Item count 0 returns a single empty page.
 */
export function paginateItems(totalItems: number): Array<[number, number]> {
  const n = Math.max(0, Math.floor(totalItems))
  if (n <= PAGE_CAPACITY.single) return [[0, n]]

  let pages = 2
  while (totalCapacity(pages) < n) pages += 1

  let sizes: number[]
  if (pages === 2) {
    // First page heavy, but never leave the totals page with fewer
    // than 4 rows when the first page can spare them.
    let firstCount = Math.min(PAGE_CAPACITY.first, n - 1)
    if (n - firstCount < 4) firstCount = n - 4
    sizes = [firstCount, n - firstCount]
  } else {
    const tailCaps = [
      ...Array(pages - 2).fill(PAGE_CAPACITY.middle),
      PAGE_CAPACITY.lastWithTotals,
    ]
    sizes = [PAGE_CAPACITY.first, ...distributeTail(n - PAGE_CAPACITY.first, tailCaps)]
  }

  const ranges: Array<[number, number]> = []
  let cursor = 0
  for (const size of sizes) {
    ranges.push([cursor, cursor + size])
    cursor += size
  }
  return ranges
}

/** Convenience: slices an items array into per-page arrays. */
export function paginateArray<T>(items: T[]): T[][] {
  return paginateItems(items.length).map(([a, b]) => items.slice(a, b))
}
