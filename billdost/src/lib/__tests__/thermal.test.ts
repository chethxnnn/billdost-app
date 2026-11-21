import { describe, expect, it } from 'vitest'
import {
  padReceiptRow,
  receiptCharsPerLine,
  receiptDivider,
  receiptItemLines,
  wrapReceiptText,
} from '../thermal'

const inr = (n: number) => `Rs.${n.toFixed(2)}`

describe('receiptCharsPerLine', () => {
  it('maps paper widths to monospace columns', () => {
    expect(receiptCharsPerLine(58)).toBe(32)
    expect(receiptCharsPerLine(80)).toBe(48)
  })
})

describe('wrapReceiptText', () => {
  it('wraps on word boundaries', () => {
    expect(wrapReceiptText('Basmati Rice Premium Quality 5kg', 16)).toEqual([
      'Basmati Rice',
      'Premium Quality',
      '5kg',
    ])
  })

  it('hard-cuts a single word longer than the width', () => {
    expect(wrapReceiptText('ABCDEFGHIJKLMNOP', 8)).toEqual(['ABCDEFGH'])
  })

  it('collapses whitespace and handles empty input', () => {
    expect(wrapReceiptText('  a   b  ', 10)).toEqual(['a b'])
    expect(wrapReceiptText('', 10)).toEqual([])
  })
})

describe('padReceiptRow', () => {
  it('right-aligns the value at the exact width', () => {
    const row = padReceiptRow('Total', 'Rs.100.00', 20)
    expect(row).toHaveLength(20)
    expect(row.endsWith('Rs.100.00')).toBe(true)
    expect(row.startsWith('Total')).toBe(true)
  })

  it('truncates the left side, never the amount', () => {
    const row = padReceiptRow('A very long item name that cannot fit', 'Rs.999.00', 20)
    expect(row).toHaveLength(20)
    expect(row.endsWith('Rs.999.00')).toBe(true)
  })
})

describe('receiptItemLines', () => {
  it('renders name lines plus a qty x rate detail row', () => {
    const lines = receiptItemLines({
      name: 'Toor Dal 1kg',
      quantity: 2,
      unitPrice: 165,
      amount: 330,
      width: 32,
      formatAmount: inr,
    })
    expect(lines[0]).toBe('Toor Dal 1kg')
    expect(lines[1]).toHaveLength(32)
    expect(lines[1]).toContain('2 x Rs.165.00')
    expect(lines[1].endsWith('Rs.330.00')).toBe(true)
  })

  it('caps the name at two lines and keeps fractional quantities', () => {
    const lines = receiptItemLines({
      name: 'Super Premium Long Grain Basmati Rice Family Pack Extra Large',
      quantity: 0.5,
      unitPrice: 649,
      amount: 324.5,
      width: 32,
      formatAmount: inr,
    })
    expect(lines).toHaveLength(3)
    expect(lines[2]).toContain('0.5 x Rs.649.00')
  })
})

describe('receiptDivider', () => {
  it('fills the width', () => {
    expect(receiptDivider(10)).toBe('----------')
    expect(receiptDivider(5, '=')).toBe('=====')
  })
})
