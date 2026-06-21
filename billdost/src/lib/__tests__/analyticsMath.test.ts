import { describe, it, expect } from 'vitest'
import { calculateForecast } from '../analyticsMath'

describe('calculateForecast', () => {
  it('should calculate forecast and trend correctly for an upward trending product', () => {
    const data: Record<string, [number, number, number, number]> = {
      'Apples': [10, 20, 30, 40]
    }

    const result = calculateForecast(data)
    expect(result.length).toBe(1)
    expect(result[0].productName).toBe('Apples')
    expect(result[0].trend).toBe('up')
    
    // wma = (10*1 + 20*2 + 30*3 + 40*4)/10 = (10 + 40 + 90 + 160)/10 = 300/10 = 30
    // slope = (40 - 10)/3 = 30/3 = 10
    // forecast15 = 30 + 10 = 40
    // forecast7 = ceil(40/2) = 20
    expect(result[0].predictedQuantity).toBe(20)
  })

  it('should calculate forecast and trend correctly for a downward trending product', () => {
    const data: Record<string, [number, number, number, number]> = {
      'Bananas': [50, 40, 20, 10]
    }

    const result = calculateForecast(data)
    expect(result[0].productName).toBe('Bananas')
    expect(result[0].trend).toBe('down')
    
    // wma = (50*1 + 40*2 + 20*3 + 10*4)/10 = (50 + 80 + 60 + 40)/10 = 230/10 = 23
    // slope = (10 - 50)/3 = -40/3 = -13.333
    // forecast15 = 23 + -13.333 = 9.667 = 10
    // forecast7 = ceil(10/2) = 5
    expect(result[0].predictedQuantity).toBe(5)
  })

  it('should return stable trend when changes are small', () => {
    const data: Record<string, [number, number, number, number]> = {
      'Oranges': [100, 105, 95, 100]
    }

    const result = calculateForecast(data)
    expect(result[0].productName).toBe('Oranges')
    expect(result[0].trend).toBe('stable')
    
    // wma = (100*1 + 105*2 + 95*3 + 100*4)/10 = (100 + 210 + 285 + 400)/10 = 995/10 = 99.5
    // slope = (100 - 100)/3 = 0
    // forecast15 = Math.round(99.5) = 100
    // forecast7 = 50
    expect(result[0].predictedQuantity).toBe(50)
  })

  it('should never return negative predicted quantities', () => {
    const data: Record<string, [number, number, number, number]> = {
      'Grapes': [100, 0, 0, 0]
    }

    const result = calculateForecast(data)
    // slope = (0 - 100)/3 = -33.33
    // wma = 100/10 = 10
    // forecast15 = 10 - 33.33 = -23.33 => floored to 0 by logic
    expect(result[0].predictedQuantity).toBe(0)
  })

  it('should properly detect dead products (no sales recently)', () => {
    const data: Record<string, [number, number, number, number]> = {
      'Kiwi': [0, 0, 10, 0]
    }
    const result = calculateForecast(data)
    expect(result[0].trend).toBe('down')
    expect(result[0].reason).toContain('sharp decline')
  })
})
