/**
 * Thermal receipt layout helpers (blueprint D3). Pure text layout for
 * monospace receipt printers: the receipt is built from fixed-width
 * lines so amounts always land in the right column, long item names
 * wrap to at most two lines, and the amount column is never truncated.
 */

/** Monospace characters per line for standard receipt paper widths. */
export function receiptCharsPerLine(widthMm: 58 | 80): number {
  return widthMm === 58 ? 32 : 48
}

/** Greedy word wrap. A single word longer than the width is hard-cut. */
export function wrapReceiptText(text: string, width: number): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const words = clean.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= width) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word.length > width ? word.slice(0, width) : word
    }
  }
  if (current) lines.push(current)
  return lines
}

/**
 * One receipt row: left text and a right-aligned value. The right side
 * always survives intact; the left side is truncated with room for at
 * least one space between the two.
 */
export function padReceiptRow(left: string, right: string, width: number): string {
  const rightText = String(right)
  if (rightText.length >= width) return rightText
  const maxLeft = width - rightText.length - 1
  const leftText = left.length > maxLeft ? left.slice(0, Math.max(maxLeft, 0)) : left
  return leftText + ' '.repeat(width - leftText.length - rightText.length) + rightText
}

/**
 * The lines for one billed item: the name (wrapped, at most 2 lines),
 * then a detail row "qty x rate" with the line amount right-aligned.
 */
export function receiptItemLines(input: {
  name: string
  quantity: number
  unitPrice: number
  amount: number
  width: number
  formatAmount: (n: number) => string
}): string[] {
  const nameLines = wrapReceiptText(input.name, input.width).slice(0, 2)
  const qtyText = Number.isInteger(input.quantity)
    ? String(input.quantity)
    : String(Math.round(input.quantity * 1000) / 1000)
  const detail = padReceiptRow(
    `  ${qtyText} x ${input.formatAmount(input.unitPrice)}`,
    input.formatAmount(input.amount),
    input.width
  )
  return [...nameLines, detail]
}

/** A full-width divider line for the receipt. */
export function receiptDivider(width: number, char = '-'): string {
  return char.repeat(width)
}
